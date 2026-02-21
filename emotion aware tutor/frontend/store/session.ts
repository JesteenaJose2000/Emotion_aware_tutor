import { create } from 'zustand';
import { FERState, SessionMode, SessionHistory, Question } from '@/types/api';
import { PolicyKind } from '@/src/types/ab';
import { generateUUID } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { computeReward, computeEngagement, computeMasteryGain } from '@/src/lib/reward';
import { mean, cumulativeSum } from '@/src/lib/metrics';
import { createActionKey } from '@/src/lib/hist';

interface SessionSummary {
  turns: number;
  accuracyMean: number;
  engagementMean: number;
  cumulativeReward: number;
  perConceptMastery: Record<string, number>;
}

interface SessionState {
  // Session data
  sessionId: string | null;
  mode: SessionMode;
  policyKind: PolicyKind;
  isActive: boolean;
  sessionStartTime: number | null;
  
  // Current question state
  currentQuestion: Question | null;
  currentDifficulty: number;
  currentConcept: string;
  turn: number;
  
  // FER state
  fer: FERState;
  // Voice SER state and fusion
  micEnabled: boolean;
  voiceFer: { pos: number; neu: number; fru: number; vad: number };
  minVadToUse: number;
  fusedFer: { pos: number; neu: number; fru: number };
  
  // User progress
  mastery: number;
  totalReward: number;
  
  // History arrays
  history: SessionHistory[];
  accuracyHistory: number[];
  engagementHistory: number[];
  rewardHistory: number[];
  actionHistory: string[]; // Action keys for histogram
  difficultyHistory: number[]; // Difficulty per turn
  
  // Loading states
  isLoadingQuestion: boolean;
  isSubmitting: boolean;
  questionStartTs: number | null;
  feedbackType: 'hint' | 'encourage' | 'neutral' | null;
  rewardPrev: number | null; // Last reward for RL update
  
  // Session summary
  summary: SessionSummary | null;
  
  // Actions
  startSession: (mode: SessionMode) => Promise<void>;
  endSession: () => void;
  resetSession: () => void;
  loadNextQuestion: () => Promise<void>;
  submitAnswer: (answerText: string, fer: FERState, rtMs: number) => Promise<any>;
  updateFER: (fer: FERState) => void;
  setMicEnabled: (on: boolean) => void;
  setMinVadToUse: (v: number) => void;
  setVoiceFer: (fer: { pos: number; neu: number; fru: number; vad: number }) => void;
  setFusedFer: (fer: { pos: number; neu: number; fru: number }) => void;
  setMode: (mode: SessionMode) => void;
  setPolicyKind: (policyKind: PolicyKind) => void;
  
  // Selectors
  cumulativeReward: number;
  accuracyMean: number;
  engagementMean: number;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  sessionId: null,
  mode: 'bandit', // Always use bandit mode (the agent)
  policyKind: 'thompson', // Not used in UI, but kept for compatibility
  isActive: false,
  sessionStartTime: null,
  currentQuestion: null,
  currentDifficulty: 2,
  currentConcept: 'Maths Concept',
  turn: 0,
  fer: { positive: 0.34, neutral: 0.33, frustrated: 0.33 },
  micEnabled: false,
  voiceFer: { pos: 1/3, neu: 1/3, fru: 1/3, vad: 0 },
  minVadToUse: 0.2,
  fusedFer: { pos: 1/3, neu: 1/3, fru: 1/3 },
  mastery: 0,
  totalReward: 0,
  history: [],
  accuracyHistory: [],
  engagementHistory: [],
  rewardHistory: [],
  actionHistory: [],
  difficultyHistory: [],
  isLoadingQuestion: false,
  isSubmitting: false,
  questionStartTs: null,
  feedbackType: null,
  rewardPrev: null,
  summary: null,

  // Selectors
  get cumulativeReward() {
    return get().rewardHistory.reduce((sum, reward) => sum + reward, 0);
  },
  get accuracyMean() {
    return mean(get().accuracyHistory);
  },
  get engagementMean() {
    return mean(get().engagementHistory);
  },
  get masteryByConcept() {
    const state = get();
    return { [state.currentConcept]: state.mastery };
  },

  // Actions
  startSession: async (mode: SessionMode) => {
    const sessionId = generateUUID();
    const sessionStartTime = Date.now();
    
    try {
      await apiClient.start(sessionId);
      
      set({
        sessionId,
        mode,
        isActive: true,
        sessionStartTime,
        currentQuestion: null,
        currentDifficulty: 2,
        currentConcept: 'Maths Concept',
        turn: 0,
        fer: { positive: 0.34, neutral: 0.33, frustrated: 0.33 },
        mastery: 0,
        totalReward: 0,
        history: [],
        accuracyHistory: [],
        engagementHistory: [],
        rewardHistory: [],
        isLoadingQuestion: false,
        isSubmitting: false,
        questionStartTs: null,
        feedbackType: null,
        summary: null,
      });
      
      // Load first question
      await get().loadNextQuestion();
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  },

  endSession: () => {
    const state = get();
    
    // Debug: Log the state values
    console.log('End session state:', {
      turn: state.turn,
      accuracyHistory: state.accuracyHistory,
      engagementHistory: state.engagementHistory,
      rewardHistory: state.rewardHistory,
      mastery: state.mastery,
      currentConcept: state.currentConcept,
    });
    
    // Calculate means directly from histories to ensure accuracy
    const accuracyMean = state.accuracyHistory.length > 0 
      ? state.accuracyHistory.reduce((sum, acc) => sum + acc, 0) / state.accuracyHistory.length 
      : 0;
    const engagementMean = state.engagementHistory.length > 0
      ? state.engagementHistory.reduce((sum, eng) => sum + eng, 0) / state.engagementHistory.length
      : 0;
    const cumulativeReward = state.rewardHistory.reduce((sum, reward) => sum + reward, 0);
    
    console.log('[SUMMARY CALCULATION]', {
      accuracyHistoryLength: state.accuracyHistory.length,
      engagementHistoryLength: state.engagementHistory.length,
      accuracyMean,
      engagementMean,
      cumulativeReward,
      accuracyHistory: state.accuracyHistory,
      engagementHistory: state.engagementHistory,
    });
    
    const summary: SessionSummary = {
      turns: state.turn,
      accuracyMean,
      engagementMean,
      cumulativeReward,
      perConceptMastery: { [state.currentConcept]: state.mastery },
    };
    
    console.log('Generated summary:', summary);
    
    set({
      isActive: false,
      summary,
    });
  },

  resetSession: () => {
    set({
      sessionId: null,
      isActive: false,
      sessionStartTime: null,
      currentQuestion: null,
      currentDifficulty: 2,
      currentConcept: 'Maths Concept',
      turn: 0,
      fer: { positive: 0.34, neutral: 0.33, frustrated: 0.33 },
      mastery: 0,
      totalReward: 0,
      history: [],
      accuracyHistory: [],
      engagementHistory: [],
      rewardHistory: [],
      actionHistory: [],
      difficultyHistory: [],
      isLoadingQuestion: false,
      isSubmitting: false,
      questionStartTs: null,
      feedbackType: null,
      summary: null,
    });
  },

  loadNextQuestion: async () => {
    const { sessionId, currentConcept, isLoadingQuestion } = get();
    
    if (!sessionId || isLoadingQuestion) return;
    
    set({ isLoadingQuestion: true });
    
    try {
      const question = await apiClient.next(sessionId, currentConcept);
      
      set(state => ({
        currentQuestion: question,
        currentDifficulty: question.difficulty,
        isLoadingQuestion: false,
        questionStartTs: Date.now(),
        feedbackType: null,
      }));
    } catch (error) {
      console.error('Failed to load next question:', error);
      set({ isLoadingQuestion: false });
      throw error;
    }
  },

  submitAnswer: async (answerText: string, fer: FERState, rtMs: number) => {
    const { 
      sessionId, 
      currentQuestion, 
      currentDifficulty, 
      currentConcept, 
      isSubmitting,
      questionStartTs,
      voiceFer,
    } = get();
    
    if (!sessionId || !currentQuestion || isSubmitting) return;
    
    set({ isSubmitting: true });
    
    try {
      const rtComputed = questionStartTs ? Date.now() - questionStartTs : rtMs;
      const payload = {
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_text: answerText,
        rt_ms: rtComputed,
        fer_positive: fer.positive,
        fer_neutral: fer.neutral,
        fer_frustrated: fer.frustrated,
        ser_positive: voiceFer?.pos,
        ser_neutral: voiceFer?.neu,
        ser_frustrated: voiceFer?.fru,
        ser_vad: voiceFer?.vad,
        correct_answer: currentQuestion.answer,
        concept: currentConcept,
        difficulty: currentDifficulty,
      };
      
      // Debug logging to verify values being sent
      console.log('[SUBMIT] FER:', { pos: fer.positive, neu: fer.neutral, fru: fer.frustrated });
      console.log('[SUBMIT] SER:', voiceFer ? { pos: voiceFer.pos, neu: voiceFer.neu, fru: voiceFer.fru, vad: voiceFer.vad } : 'None');
      
      const response = await apiClient.submit(payload);
      
      // Calculate accuracy (0 or 1)
      const isCorrect = answerText === currentQuestion.answer.toString();
      const accuracy = isCorrect ? 1 : 0;
      
      // Calculate engagement (positive - frustrated)
      const engagement = computeEngagement(fer);
      
      // Calculate mastery gain
      const prevMastery = get().mastery;
      const deltaM = computeMasteryGain(prevMastery, response.mastery);
      
      // Compute reward using centralized function (includes engagement & mastery) for display/analytics
      const computedReward = computeReward(accuracy, engagement, deltaM);
      
      // Use backend reward as the primary source since that's what the agent uses for learning
      // Backend reward is calculated by the agent and reflects the actual RL learning signal
      // Frontend reward is only for display/analytics purposes
      const finalReward = response.reward !== undefined && response.reward !== null ? response.reward : computedReward;
      
      // Debug logging to understand reward calculation
      console.log('[REWARD DEBUG]', {
        accuracy,
        engagement,
        deltaM,
        prevMastery,
        currentMastery: response.mastery,
        computedReward,
        backendReward: response.reward,
        finalReward,
        fer: { pos: fer.positive, neu: fer.neutral, fru: fer.frustrated }
      });
      
      // Update histories
      set(state => {
        const newAccuracyHistory = [...state.accuracyHistory, accuracy];
        const newEngagementHistory = [...state.engagementHistory, engagement];
        const newRewardHistory = [...state.rewardHistory, finalReward];
        
        // Debug: Log history updates
        console.log('[HISTORY UPDATE]', {
          turn: state.turn + 1,
          accuracy,
          engagement,
          finalReward,
          rewardHistoryLength: newRewardHistory.length,
          rewardHistory: newRewardHistory,
          cumulativeReward: newRewardHistory.reduce((sum, r) => sum + r, 0),
          accuracyHistoryLength: newAccuracyHistory.length,
          engagementHistoryLength: newEngagementHistory.length,
        });
        
        return {
          accuracyHistory: newAccuracyHistory,
          engagementHistory: newEngagementHistory,
          rewardHistory: newRewardHistory,
          actionHistory: [...state.actionHistory, createActionKey(response.next_action.diff_delta, response.next_action.feedback)],
          difficultyHistory: [...state.difficultyHistory, currentDifficulty],
          totalReward: state.totalReward + finalReward,
          mastery: response.mastery,
          feedbackType: response.next_action.feedback,
          turn: state.turn + 1,
          isSubmitting: false,
          rewardPrev: finalReward, // Store for RL update
        };
      });

      // CSV log of VAD and fusion lambda per turn
      try {
        const vadThreshold = get().minVadToUse;
        const vadValue = get().voiceFer?.vad ?? 0;
        const { FUSION_LAMBDA } = await import('@/src/lib/fusion');
        const row = { turn: get().turn + 1, vad_threshold: vadThreshold, vad_value: vadValue, fusion_lambda: FUSION_LAMBDA } as any;
        const { toCSV } = await import('@/lib/csv');
        const csv = toCSV([row]);
        console.log('[SER CSV]', csv);
      } catch {}
      
      // Update difficulty based on next_action
      const newDifficulty = Math.max(1, Math.min(5, currentDifficulty + response.next_action.diff_delta));
      set({ currentDifficulty: newDifficulty });
      
      // Add to history
      const historyEntry: SessionHistory = {
        questionId: currentQuestion.id,
        concept: currentConcept,
        difficulty: currentDifficulty,
        userAnswer: answerText,
        correctAnswer: currentQuestion.answer,
        responseTime: rtComputed,
        fer: { ...fer },
        reward: response.reward,
        mastery: response.mastery,
        timestamp: Date.now(),
      };
      
      set(state => ({
        history: [...state.history, historyEntry],
      }));
      
      // Small delay to let feedback bubble show
      await new Promise(res => setTimeout(res, 600));
      await get().loadNextQuestion();
      
      return response;
    } catch (error) {
      console.error('Failed to submit answer:', error);
      set({ isSubmitting: false });
      throw error;
    }
  },

  updateFER: (fer: FERState) => {
    set({ fer });
  },

  setMicEnabled: (on: boolean) => set({ micEnabled: on }),
  setMinVadToUse: (v: number) => set({ minVadToUse: Math.max(0, Math.min(1, v)) }),
  setVoiceFer: (ferIn) => set({ voiceFer: ferIn }),
  setFusedFer: (f) => {
    set({ fusedFer: f });
    // Keep existing UI in sync by updating legacy fer structure
    set({ fer: { positive: f.pos, neutral: f.neu, frustrated: f.fru } as any });
  },

  setMode: (mode: SessionMode) => {
    set({ mode });
  },

  setPolicyKind: (policyKind: PolicyKind) => {
    set({ policyKind });
    // Reset policy state when switching
    // TODO: Add policy instance reset logic here
  },

}));