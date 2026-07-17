import { useCallback, useEffect, useRef, useState } from "react";

import {
  createBilingualSpeechController,
  type SpeechPlaybackController,
  type SpeechPlaybackState,
} from "./bilingualSpeech";

export const CONTINUOUS_LISTENING_INTER_CARD_PAUSE_MS = 1000;

export interface ListeningItem {
  id: string;
  label: string;
  chineseText: string;
  japaneseText: string;
}

export type ContinuousListeningPhase =
  | "idle"
  | "playing-chinese"
  | "between-languages"
  | "playing-japanese"
  | "between-cards"
  | "paused"
  | "completed"
  | "stopped"
  | "error"
  | "unsupported";

export interface ContinuousListeningState {
  phase: ContinuousListeningPhase;
  activeIndex: number;
  errorMessage?: string;
}

interface ContinuousListeningOptions {
  items: ListeningItem[];
  currentIndex: number;
  roundIdentity: string;
  navigateToIndex: (index: number) => void;
  interCardPauseMs?: number;
}

function isEngagedPhase(phase: ContinuousListeningPhase) {
  return (
    phase === "playing-chinese" ||
    phase === "between-languages" ||
    phase === "playing-japanese" ||
    phase === "between-cards" ||
    phase === "paused"
  );
}

export function useContinuousListening({
  items,
  currentIndex,
  roundIdentity,
  navigateToIndex,
  interCardPauseMs = CONTINUOUS_LISTENING_INTER_CARD_PAUSE_MS,
}: ContinuousListeningOptions) {
  const itemsRef = useRef(items);
  const currentIndexRef = useRef(currentIndex);
  const navigateToIndexRef = useRef(navigateToIndex);
  const stateRef = useRef<ContinuousListeningState>({
    phase: "idle",
    activeIndex: currentIndex,
  });
  const [state, setState] = useState<ContinuousListeningState>({
    phase: "idle",
    activeIndex: currentIndex,
  });
  const controllerRef = useRef<SpeechPlaybackController | undefined>(undefined);
  const generationRef = useRef(0);
  const interCardTimerRef = useRef<number | undefined>(undefined);
  const expectedNavigationIndexRef = useRef<number | undefined>(undefined);
  const previousCurrentIndexRef = useRef(currentIndex);
  const previousCurrentItemIdRef = useRef(items[currentIndex]?.id);
  const previousRoundIdentityRef = useRef(roundIdentity);
  const activeItemIdRef = useRef<string | undefined>(undefined);
  const suppressControllerStopRef = useRef(false);
  const playIndexRef = useRef<
    ((index: number, generation: number) => void) | undefined
  >(undefined);

  const publishState = useCallback((nextState: ContinuousListeningState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const clearInterCardTimer = useCallback(() => {
    if (interCardTimerRef.current !== undefined) {
      window.clearTimeout(interCardTimerRef.current);
      interCardTimerRef.current = undefined;
    }
  }, []);

  const invalidateSession = useCallback(() => {
    generationRef.current += 1;
    clearInterCardTimer();
    expectedNavigationIndexRef.current = undefined;
  }, [clearInterCardTimer]);

  const stopControllerWithoutExternalState = useCallback(() => {
    suppressControllerStopRef.current = true;
    controllerRef.current?.stop();
    suppressControllerStopRef.current = false;
  }, []);

  useEffect(() => {
    itemsRef.current = items;
    currentIndexRef.current = currentIndex;
    navigateToIndexRef.current = navigateToIndex;
  }, [currentIndex, items, navigateToIndex]);

  useEffect(() => {
    function handleSpeechState(speechState: SpeechPlaybackState) {
      if (speechState.phase === "speaking-chinese") {
        publishState({
          phase: "playing-chinese",
          activeIndex: stateRef.current.activeIndex,
        });
      } else if (speechState.phase === "pause") {
        publishState({
          phase: "between-languages",
          activeIndex: stateRef.current.activeIndex,
        });
      } else if (speechState.phase === "speaking-japanese") {
        publishState({
          phase: "playing-japanese",
          activeIndex: stateRef.current.activeIndex,
        });
      } else if (
        speechState.phase === "stopped" &&
        !suppressControllerStopRef.current
      ) {
        invalidateSession();
        publishState({
          phase: "stopped",
          activeIndex: stateRef.current.activeIndex,
        });
      } else if (speechState.phase === "error") {
        invalidateSession();
        publishState({
          phase: "error",
          activeIndex: stateRef.current.activeIndex,
          errorMessage: speechState.errorMessage,
        });
      } else if (speechState.phase === "unsupported") {
        invalidateSession();
        publishState({
          phase: "unsupported",
          activeIndex: stateRef.current.activeIndex,
        });
      }
    }

    const controller = createBilingualSpeechController({
      onStateChange: handleSpeechState,
      retainOwnershipAfterCompletion: true,
    });
    controllerRef.current = controller;
    if (!controller.isSupported()) {
      publishState({
        phase: "unsupported",
        activeIndex: currentIndexRef.current,
      });
    }

    return () => {
      invalidateSession();
      controller.destroy();
      controllerRef.current = undefined;
    };
  }, [invalidateSession, publishState]);

  const playIndex = useCallback(
    async (index: number, generation: number) => {
      const item = itemsRef.current[index];
      const controller = controllerRef.current;
      if (!item || !controller || generation !== generationRef.current) return;

      activeItemIdRef.current = item.id;
      publishState({ phase: "playing-chinese", activeIndex: index });

      try {
        await controller.play({
          chineseText: item.chineseText,
          japaneseText: item.japaneseText,
        });
      } catch {
        return;
      }

      if (
        generation !== generationRef.current ||
        stateRef.current.phase === "stopped" ||
        stateRef.current.phase === "paused" ||
        stateRef.current.phase === "error" ||
        stateRef.current.phase === "unsupported"
      ) {
        return;
      }

      const nextIndex = index + 1;
      if (nextIndex >= itemsRef.current.length) {
        stopControllerWithoutExternalState();
        publishState({ phase: "completed", activeIndex: index });
        return;
      }

      publishState({ phase: "between-cards", activeIndex: index });
      interCardTimerRef.current = window.setTimeout(() => {
        interCardTimerRef.current = undefined;
        if (generation !== generationRef.current) return;

        expectedNavigationIndexRef.current = nextIndex;
        navigateToIndexRef.current(nextIndex);
      }, interCardPauseMs);
    },
    [interCardPauseMs, publishState, stopControllerWithoutExternalState],
  );

  useEffect(() => {
    playIndexRef.current = (index, generation) => {
      void playIndex(index, generation);
    };
  }, [playIndex]);

  const stop = useCallback(() => {
    if (!isEngagedPhase(stateRef.current.phase)) return;

    invalidateSession();
    stopControllerWithoutExternalState();
    publishState({
      phase: "stopped",
      activeIndex: stateRef.current.activeIndex,
    });
  }, [invalidateSession, publishState, stopControllerWithoutExternalState]);

  const stopForNavigation = useCallback(() => {
    stop();
  }, [stop]);

  useEffect(() => {
    const roundChanged = previousRoundIdentityRef.current !== roundIdentity;
    const currentItemId = items[currentIndex]?.id;
    const indexChanged = previousCurrentIndexRef.current !== currentIndex;
    const itemChanged =
      previousCurrentItemIdRef.current !== undefined &&
      previousCurrentItemIdRef.current !== currentItemId;
    previousRoundIdentityRef.current = roundIdentity;
    previousCurrentIndexRef.current = currentIndex;
    previousCurrentItemIdRef.current = currentItemId;
    currentIndexRef.current = currentIndex;

    if (roundChanged && isEngagedPhase(stateRef.current.phase)) {
      stop();
      return;
    }

    if (!indexChanged && !itemChanged) return;

    if (
      expectedNavigationIndexRef.current === currentIndex &&
      stateRef.current.phase === "between-cards"
    ) {
      expectedNavigationIndexRef.current = undefined;
      playIndexRef.current?.(currentIndex, generationRef.current);
      return;
    }

    if (isEngagedPhase(stateRef.current.phase)) {
      stop();
      publishState({ phase: "stopped", activeIndex: currentIndex });
      return;
    }

    publishState({
      phase:
        stateRef.current.phase === "unsupported"
          ? "unsupported"
          : stateRef.current.phase === "stopped"
            ? "stopped"
            : "idle",
      activeIndex: currentIndex,
    });
  }, [currentIndex, items, publishState, roundIdentity, stop]);

  useEffect(() => {
    const activeItem = items[stateRef.current.activeIndex];
    if (
      isEngagedPhase(stateRef.current.phase) &&
      (!activeItem ||
        activeItem.id !== activeItemIdRef.current ||
        currentIndex < 0)
    ) {
      stop();
    }
  }, [currentIndex, items, stop]);

  const start = useCallback(() => {
    const controller = controllerRef.current;
    const index = currentIndexRef.current;
    if (
      !controller ||
      !controller.isSupported() ||
      index < 0 ||
      !itemsRef.current[index] ||
      isEngagedPhase(stateRef.current.phase)
    ) {
      return;
    }

    invalidateSession();
    const generation = generationRef.current;
    playIndexRef.current?.(index, generation);
  }, [invalidateSession]);

  const pause = useCallback(() => {
    if (
      stateRef.current.phase !== "playing-chinese" &&
      stateRef.current.phase !== "between-languages" &&
      stateRef.current.phase !== "playing-japanese" &&
      stateRef.current.phase !== "between-cards"
    ) {
      return;
    }

    const activeIndex = stateRef.current.activeIndex;
    invalidateSession();
    stopControllerWithoutExternalState();
    publishState({ phase: "paused", activeIndex });
  }, [invalidateSession, publishState, stopControllerWithoutExternalState]);

  const resume = useCallback(() => {
    if (stateRef.current.phase !== "paused") return;

    const index = stateRef.current.activeIndex;
    if (
      index !== currentIndexRef.current ||
      !itemsRef.current[index] ||
      !controllerRef.current?.isSupported()
    ) {
      publishState({ phase: "stopped", activeIndex: currentIndexRef.current });
      return;
    }

    invalidateSession();
    playIndexRef.current?.(index, generationRef.current);
  }, [invalidateSession, publishState]);

  const retry = useCallback(() => {
    if (stateRef.current.phase !== "error") return;
    invalidateSession();
    playIndexRef.current?.(currentIndexRef.current, generationRef.current);
  }, [invalidateSession]);

  const item =
    items[state.activeIndex] ??
    (currentIndex >= 0 ? items[currentIndex] : undefined);

  return {
    state,
    item,
    isEngaged: isEngagedPhase(state.phase),
    canStart:
      state.phase !== "unsupported" &&
      !isEngagedPhase(state.phase) &&
      currentIndex >= 0 &&
      Boolean(items[currentIndex]),
    start,
    pause,
    resume,
    stop,
    retry,
    stopForNavigation,
  };
}
