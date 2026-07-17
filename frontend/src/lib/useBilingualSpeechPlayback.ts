import { useCallback, useEffect, useRef, useState } from "react";

import {
  createBilingualSpeechController,
  isBilingualSpeechSupported,
  type BilingualSpeechRequest,
  type SpeechPlaybackController,
  type SpeechPlaybackState,
} from "./bilingualSpeech";

function getInitialPlaybackState(): SpeechPlaybackState {
  return {
    phase: isBilingualSpeechSupported() ? "idle" : "unsupported",
  };
}

export function useBilingualSpeechPlayback(request: BilingualSpeechRequest) {
  const [state, setState] = useState<SpeechPlaybackState>(
    getInitialPlaybackState,
  );
  const controllerRef = useRef<SpeechPlaybackController | undefined>(undefined);
  const requestRef = useRef(request);

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    const controller = createBilingualSpeechController({
      onStateChange: setState,
    });
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = undefined;
    };
  }, []);

  const play = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    void controller.play(requestRef.current).catch(() => {
      // The controller exposes normalized failures through playback state.
    });
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const isPlaying =
    state.phase === "speaking-chinese" ||
    state.phase === "pause" ||
    state.phase === "speaking-japanese";

  return {
    state,
    isPlaying,
    play,
    stop,
  };
}
