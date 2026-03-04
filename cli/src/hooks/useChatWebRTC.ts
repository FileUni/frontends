//! WebRTC logic management
//! Use Perfect Negotiation pattern to resolve conflicts

import { useCallback, useRef, useMemo } from "react";
import type {
  WireSignalPayload,
  WireMessage,
  TransportType,
} from "./ChatTypes";
import { toast } from "@fileuni/shared";
import i18next from "@/lib/i18n";
import { createClientUniqueId } from "@/lib/id.ts";

interface WebRTCOptions {
  selfId: string;
  stunServers: string[];
  turnServers?: { url: string; username?: string; credential?: string }[];
  enableWebRTC: boolean;
  transportBackend: TransportType;
  nicknames: Record<string, string>;
  sendWireMessage: (m: WireMessage) => void;
  onMessage: (raw: string, source: TransportType) => Promise<void>;
  onTransportChange: (t: TransportType) => void;
  onConnectionStatus?: (
    targetId: string,
    status: "connected" | "failed" | "disconnected",
  ) => void;
  onRemoteStream?: (targetId: string, stream: MediaStream | null) => void;
}

export const useChatWebRTC = (options: WebRTCOptions) => {
  const {
    selfId,
    stunServers,
    turnServers = [],
    enableWebRTC,
    transportBackend,
    sendWireMessage,
    onMessage,
    onTransportChange,
    onConnectionStatus,
    onRemoteStream,
  } = options;

  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dcMapRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  // File receiving buffers
  const fileReceivingRef = useRef<
    Map<
      string,
      {
        name: string;
        size: number;
        mime: string;
        receivedSize: number;
        chunks: ArrayBuffer[];
      }
    >
  >(new Map());

  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const candidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );

  const setupDataChannel = useCallback(
    (targetId: string, dc: RTCDataChannel) => {
      dc.binaryType = "arraybuffer";
      dc.onopen = null;
      dc.onclose = null;
      dc.onmessage = null;

      dcMapRef.current.set(targetId, dc);

      dc.onopen = () => {
        console.log(`[Chat] DataChannel with ${targetId} OPEN`);
        onTransportChange("webrtc");
      };

      dc.onclose = () => {
        console.log(`[Chat] DataChannel with ${targetId} CLOSED`);
        if (dcMapRef.current.get(targetId) === dc) {
          dcMapRef.current.delete(targetId);
          onTransportChange(transportBackend);
        }
      };

      dc.onmessage = async (event) => {
        if (typeof event.data === "string") {
          const parsed = JSON.parse(event.data);
          // Handle file transfer signaling
          if (parsed.type === "FILE_START") {
            fileReceivingRef.current.set(parsed.fileId, {
              ...parsed.info,
              receivedSize: 0,
              chunks: [],
            });
            return;
          }
          await onMessage(event.data, "webrtc");
        } else {
          // Handle binary chunks
          const buffer = event.data as ArrayBuffer;
          // Header contains 36 chars fileId
          const header = new TextDecoder().decode(buffer.slice(0, 36));
          const fileId = header.trim();
          const chunk = buffer.slice(36);

          const receiving = fileReceivingRef.current.get(fileId);
          if (receiving) {
            receiving.chunks.push(chunk);
            receiving.receivedSize += chunk.byteLength;

            if (receiving.receivedSize >= receiving.size) {
              const blob = new Blob(receiving.chunks, { type: receiving.mime });
              const localUrl = URL.createObjectURL(blob);
              await onMessage(
                JSON.stringify({
                  type: "Text",
                  payload: {
                    id: `file_${Date.now()}`,
                    from: targetId,
                    to: selfId,
                    content: `Received file: ${receiving.name}`,
                    is_group: false,
                    timestamp: Date.now(),
                    file_info: {
                      name: receiving.name,
                      size: receiving.size,
                      mime: receiving.mime,
                      localUrl,
                    },
                  },
                }),
                "webrtc",
              );
              fileReceivingRef.current.delete(fileId);
            }
          }
        }
      };
    },
    [onMessage, selfId, onTransportChange, transportBackend],
  );

  const ensurePeerConnection = useCallback(
    (targetId: string) => {
      if (!enableWebRTC) return null;
      let pc = pcMapRef.current.get(targetId);
      if (pc) return pc;

      const polite = selfId < targetId;
      console.log(
        `[Chat] Creating RTCPeerConnection for ${targetId}. Polite: ${polite}`,
      );

      const formatUrl = (url: string) =>
        url.startsWith("stun:") ||
        url.startsWith("turn:") ||
        url.startsWith("turns:")
          ? url
          : `stun:${url}`;

      const iceServers: RTCIceServer[] = stunServers.map((url) => ({
        urls: formatUrl(url),
      }));
      turnServers.forEach((srv) => {
        iceServers.push({
          urls: formatUrl(srv.url),
          username: srv.username,
          credential: srv.credential,
        });
      });
      if (iceServers.length === 0)
        iceServers.push({ urls: "stun:stun.l.google.com:19302" });

      pc = new RTCPeerConnection({ iceServers });
      pcMapRef.current.set(targetId, pc);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendWireMessage({
            type: "Signal",
            payload: {
              from: selfId,
              to: targetId,
              data: e.candidate.toJSON(),
            },
          });
        }
      };

      pc.ontrack = (e) => {
        console.log(`[Chat] Received remote track from ${targetId}`);
        const stream = e.streams[0];
        remoteStreamsRef.current.set(targetId, stream);
        onRemoteStream?.(targetId, stream);

        stream.onremovetrack = () => {
          if (stream.getTracks().length === 0) {
            remoteStreamsRef.current.delete(targetId);
            onRemoteStream?.(targetId, null);
          }
        };
      };

      pc.onconnectionstatechange = () => {
        const state = pc?.connectionState;
        console.log(`[Chat] WebRTC state with ${targetId}: ${state}`);
        if (state === "connected") {
          const dc = dcMapRef.current.get(targetId);
          if (dc?.readyState === "open") onTransportChange("webrtc");
          onConnectionStatus?.(targetId, "connected");
        } else if (["failed", "closed", "disconnected"].includes(state || "")) {
          if (pcMapRef.current.get(targetId) === pc) {
            onConnectionStatus?.(
              targetId,
              state === "failed" ? "failed" : "disconnected",
            );
            pcMapRef.current.delete(targetId);
            dcMapRef.current.delete(targetId);
            candidateQueueRef.current.delete(targetId);
            onTransportChange(transportBackend);
            onRemoteStream?.(targetId, null);
          }
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          if (pc!.signalingState !== "stable") return;
          makingOfferRef.current.set(targetId, true);
          await pc!.setLocalDescription();
          const localDescription = pc!.localDescription;
          if (!localDescription) {
            return;
          }
          sendWireMessage({
            type: "Signal",
            payload: {
              from: selfId,
              to: targetId,
              data: localDescription,
            },
          });
        } catch (err) {
          console.error("[Chat] Negotiation failed:", err);
        } finally {
          makingOfferRef.current.set(targetId, false);
        }
      };

      pc.ondatachannel = (e) => {
        setupDataChannel(targetId, e.channel);
      };

      if (!polite) {
        setupDataChannel(targetId, pc.createDataChannel("chat"));
      }

      return pc;
    },
    [
      enableWebRTC,
      stunServers,
      turnServers,
      sendWireMessage,
      selfId,
      onTransportChange,
      transportBackend,
      setupDataChannel,
      onConnectionStatus,
      onRemoteStream,
    ],
  );

  const handleSignal = useCallback(
    async (payload: WireSignalPayload) => {
      if (payload.from === selfId) return;
      const targetId = payload.from;
      const pc = ensurePeerConnection(targetId);
      if (!pc) return undefined;

      const polite = selfId < targetId;
      const description = payload.data as RTCSessionDescriptionInit;
      const candidate = payload.data as RTCIceCandidateInit;

      try {
        if (description && description.type) {
          const offerCollision =
            description.type === "offer" &&
            (makingOfferRef.current.get(targetId) ||
              pc.signalingState !== "stable");
          const ignoreOffer = !polite && offerCollision;
          ignoreOfferRef.current.set(targetId, ignoreOffer);

          if (ignoreOffer) return;

          if (offerCollision) {
            await Promise.all([
              pc.setLocalDescription({ type: "rollback" }),
              pc.setRemoteDescription(description),
            ]);
          } else {
            await pc.setRemoteDescription(description);
          }

          if (description.type === "offer") {
            await pc.setLocalDescription();
            const localDescription = pc.localDescription;
            if (!localDescription) {
              return;
            }
            sendWireMessage({
              type: "Signal",
              payload: {
                from: selfId,
                to: targetId,
                data: localDescription,
              },
            });
          }

          const queue = candidateQueueRef.current.get(targetId) || [];
          for (const cand of queue)
            await pc.addIceCandidate(cand).catch(() => {});
          candidateQueueRef.current.delete(targetId);
        } else if (candidate && candidate.candidate !== undefined) {
          if (pc.remoteDescription)
            await pc.addIceCandidate(candidate).catch(() => {});
          else {
            const queue = candidateQueueRef.current.get(targetId) || [];
            queue.push(candidate);
            candidateQueueRef.current.set(targetId, queue);
          }
        }
      } catch (err) {
        console.error("[Chat] WebRTC Signal error:", err);
      }
    },
    [ensurePeerConnection, sendWireMessage, selfId],
  );

  const startMediaCall = useCallback(
    async (targetId: string, video: boolean = false) => {
      const pc = ensurePeerConnection(targetId);
      if (!pc) return undefined;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video,
        });
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        return stream;
      } catch (err) {
        console.error("[Chat] Media access failed:", err);
        toast.error(
          i18next.t("chat.media_access_failed") ||
            "Failed to access camera/microphone",
        );
        throw err;
      }
    },
    [ensurePeerConnection],
  );

  const stopMediaCall = useCallback((targetId?: string) => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (targetId) {
      const pc = pcMapRef.current.get(targetId);
      pc?.getSenders().forEach((s) => pc.removeTrack(s));
    }
  }, []);

  const sendFile = useCallback(
    async (targetId: string, file: File, onProgress?: (p: number) => void) => {
      const dc = dcMapRef.current.get(targetId);
      if (!dc || dc.readyState !== "open")
        throw new Error("P2P connection not ready");

      const fileId = createClientUniqueId();
      dc.send(
        JSON.stringify({
          type: "FILE_START",
          fileId,
          info: { name: file.name, size: file.size, mime: file.type },
        }),
      );

      const CHUNK_SIZE = 16384;
      let offset = 0;
      const reader = new FileReader();

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (e) => {
        const chunk = e.target?.result as ArrayBuffer;
        const header = new TextEncoder().encode(fileId.padEnd(36));
        const payload = new Uint8Array(header.byteLength + chunk.byteLength);
        payload.set(header);
        payload.set(new Uint8Array(chunk), header.byteLength);

        if (dc.bufferedAmount > 4 * 1024 * 1024) {
          // 4MB buffer limit
          dc.onbufferedamountlow = () => {
            dc.onbufferedamountlow = null;
            dc.send(payload);
            continueSending();
          };
        } else {
          dc.send(payload);
          continueSending();
        }
      };

      const continueSending = () => {
        offset += CHUNK_SIZE;
        onProgress?.(Math.min(100, (offset / file.size) * 100));
        if (offset < file.size) readNextChunk();
      };

      readNextChunk();
    },
    [],
  );

  return useMemo(
    () => ({
      ensurePeerConnection,
      handleSignal,
      startMediaCall,
      stopMediaCall,
      sendFile,
      dcMapRef,
      pcMapRef,
      localStreamRef,
      remoteStreamsRef,
    }),
    [
      ensurePeerConnection,
      handleSignal,
      startMediaCall,
      stopMediaCall,
      sendFile,
    ],
  );
};
