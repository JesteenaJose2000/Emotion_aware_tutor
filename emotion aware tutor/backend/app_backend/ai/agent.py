from __future__ import annotations
import random
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
import numpy as np

DIFFICULTY_LEVELS = [1, 2, 3, 4, 5]
ACTIONS = [-1, 0, +1]
STATE_DIM = 6
ALPHA = 0.37
DIFFICULTY_WEIGHT: Dict[int, float] = {
    1: 0.13391245590321205,
    2: 0.3337729969832603,
    3: 0.6690883728286914,
    4: 0.7176417046170667,
    5: 0.9192635382533815,
}
DEFAULT_V = 0.059
MIN_V = 0.1
INITIAL_EPSILON = 0.3
MIN_EPSILON = 0.05
EPSILON_DECAY = 0.99
WARMUP_STEPS = 5
LAMBDA_ZONE = 0.3
KAPPA_FRU_DIFFICULTY = 0.25


def clamp(x: float, min_val: float, max_val: float) -> float:
    """Clamp a value between min_val and max_val."""
    return max(min_val, min(x, max_val))


def safe_get(d: Dict[str, float], key: str, default: float = 0.0) -> float:
    """Safely get a float value from a dictionary."""
    val = d.get(key, default)
    try:
        return float(val)
    except (TypeError, ValueError):
        return float(default)


@dataclass
class BanditState:
    """State for per-session bandit learning."""
    Q: Dict[int, float] = field(default_factory=lambda: {a: 0.0 for a in ACTIONS})
    N: Dict[int, int] = field(default_factory=lambda: {a: 0 for a in ACTIONS})
    A: Dict[int, np.ndarray] = field(default_factory=lambda: {a: np.identity(STATE_DIM) for a in ACTIONS})
    b: Dict[int, np.ndarray] = field(default_factory=lambda: {a: np.zeros(STATE_DIM) for a in ACTIONS})
    steps: int = 0
    epsilon: float = INITIAL_EPSILON
    last_difficulty: int = 1
    consecutive_wrong: int = 0
    recent: List[float] = field(default_factory=list)
    recent_pos: List[float] = field(default_factory=list)
    pending_state_vec: Optional[np.ndarray] = None
    pending_action: Optional[int] = None


class AdaptiveRLAgent:
    def __init__(self) -> None:
        """Initialize the adaptive RL agent."""
        self.sessions: Dict[str, BanditState] = {}

    def get_session(self, session_id: str) -> BanditState:
        """Get or create a session's bandit state."""
        if session_id not in self.sessions:
            self.sessions[session_id] = BanditState()
        return self.sessions[session_id]

    def reset_session(self, session_id: str) -> None:
        """Reset a session's bandit state."""
        if session_id in self.sessions:
            del self.sessions[session_id]

    def update_mastery(self, current_mastery: float, is_correct: bool, difficulty: int) -> float:
        """Update mastery using EMA with difficulty weighting."""
        effective_correct = 1.0 if is_correct else 0.0
        speed = DIFFICULTY_WEIGHT.get(difficulty, 0.0)
        m_new = current_mastery + ALPHA * speed * (effective_correct - current_mastery)
        m_new = clamp(m_new, 0.0, 1.0)
        if is_correct and m_new >= 0.99 and difficulty == 5:
            m_new = 1.0
        return m_new

    def build_state(
        self,
        mastery: float,
        emotions: Dict[str, float],
        is_correct: bool,
        recent_acc: float,
        recent_pos_avg: float,
        consecutive_wrong: int,
    ) -> np.ndarray:
        """Build state vector for contextual bandit."""
        pos = clamp(recent_pos_avg, 0.0, 1.0)
        fru = clamp(safe_get(emotions, "frustrated", 0.0), 0.0, 1.0)
        cw_norm = clamp(min(consecutive_wrong, 3) / 3.0, 0.0, 1.0)
        x = np.array(
            [
                clamp(mastery, 0.0, 1.0),
                pos,
                fru,
                1.0 if is_correct else 0.0,
                clamp(recent_acc, 0.0, 1.0),
                cw_norm,
            ],
            dtype=float,
        )
        return x

    def target_difficulty(self, mastery: float) -> int:
        """Map mastery to target difficulty for reward shaping."""
        m = clamp(mastery, 0.0, 1.0)
        if m < 0.20:
            return 1
        elif m < 0.40:
            return 2
        elif m < 0.60:
            return 3
        elif m < 0.80:
            return 4
        else:
            return 5

    def compute_reward(
        self,
        is_correct: bool,
        emotions: Dict[str, float],
        difficulty: int,
        delta_mastery: float,
        mastery_after: float,
        recent_pos_avg: float,
    ) -> float:
        """Compute reward with correctness, engagement, mastery gain, and soft constraints."""
        pos = clamp(recent_pos_avg, 0.0, 1.0)
        fru = clamp(safe_get(emotions, "frustrated", 0.0), 0.0, 1.0)
        engagement = pos - fru
        correctness = 1.0 if is_correct else -1.0
        diff_bonus = 0.2 * difficulty if is_correct else 0.0
        mastery_gain = delta_mastery
        tgt = self.target_difficulty(mastery_after)
        zone_penalty = -LAMBDA_ZONE * abs(difficulty - tgt)
        fru_diff_penalty = -KAPPA_FRU_DIFFICULTY * fru * max(0, difficulty - 3)
        reward = (
            1.0 * correctness
            + 0.3 * engagement
            + 0.5 * mastery_gain
            + diff_bonus
            + zone_penalty
            + fru_diff_penalty
        )
        return clamp(reward, -2.0, 2.0)

    def _choose_action_epsilon(self, st: BanditState) -> int:
        """Choose action using epsilon-greedy policy."""
        if random.random() < st.epsilon:
            return random.choice(ACTIONS)
        return max(ACTIONS, key=lambda a: st.Q[a])

    def _update_epsilon_bandit(self, st: BanditState, action: int, reward: float) -> None:
        """Update epsilon-greedy Q-values."""
        st.N[action] += 1
        n = st.N[action]
        q_old = st.Q[action]
        st.Q[action] = q_old + (reward - q_old) / max(n, 1)

    def _update_lints(self, st: BanditState, action: int, state_vec: np.ndarray, reward: float) -> None:
        """Update LinTS contextual bandit parameters."""
        x = state_vec.reshape(-1, 1)
        st.A[action] += x @ x.T
        st.b[action] += reward * state_vec

    def _choose_action_lints(self, st: BanditState, state_vec: np.ndarray) -> int:
        """Choose action using Linear Thompson Sampling."""
        v = DEFAULT_V if st.steps < 15 else MIN_V
        scores: Dict[int, float] = {}
        for a in ACTIONS:
            A_inv = np.linalg.inv(st.A[a])
            mu = A_inv @ st.b[a]
            theta = np.random.multivariate_normal(mean=mu, cov=(v ** 2) * A_inv)
            scores[a] = float(theta @ state_vec)
        return max(scores, key=scores.get)

    def step(
        self,
        session_id: str,
        current_mastery: float,
        current_difficulty: int,
        is_correct: bool,
        emotions: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Process a student's answer and determine next difficulty.
        
        Args:
            session_id: Session identifier
            current_mastery: Current mastery level (0-1)
            current_difficulty: Current difficulty level (1-5)
            is_correct: Whether the answer was correct
            emotions: Emotion dictionary with 'positive' and 'frustrated' keys
            
        Returns:
            Dictionary with next_difficulty, updated_mastery, reward, chosen_delta, and recent_acc
        """
        st = self.get_session(session_id)
        updated_mastery = self.update_mastery(current_mastery, is_correct, current_difficulty)
        delta = updated_mastery - current_mastery
        st.recent.append(1.0 if is_correct else 0.0)
        if len(st.recent) > 5:
            st.recent.pop(0)
        recent_acc = sum(st.recent) / len(st.recent)
        pos_raw = clamp(safe_get(emotions, "positive", 0.0), 0.0, 1.0)
        st.recent_pos.append(pos_raw)
        if len(st.recent_pos) > 5:
            st.recent_pos.pop(0)
        recent_pos_avg = sum(st.recent_pos) / len(st.recent_pos)
        if not is_correct:
            st.consecutive_wrong += 1
        else:
            st.consecutive_wrong = 0
        reward = self.compute_reward(
            is_correct=is_correct,
            emotions=emotions,
            difficulty=current_difficulty,
            delta_mastery=delta,
            mastery_after=updated_mastery,
            recent_pos_avg=recent_pos_avg,
        )
        if st.pending_state_vec is not None and st.pending_action is not None:
            self._update_epsilon_bandit(st, st.pending_action, reward)
            self._update_lints(st, st.pending_action, st.pending_state_vec, reward)
        st.steps += 1
        st.epsilon = max(MIN_EPSILON, st.epsilon * EPSILON_DECAY)
        state_vec = self.build_state(
            mastery=updated_mastery,
            emotions=emotions,
            is_correct=is_correct,
            recent_acc=recent_acc,
            recent_pos_avg=recent_pos_avg,
            consecutive_wrong=st.consecutive_wrong,
        )
        if st.steps <= WARMUP_STEPS:
            next_delta = random.choice(ACTIONS)
        else:
            if random.random() < st.epsilon:
                next_delta = random.choice(ACTIONS)
            else:
                next_delta = self._choose_action_lints(st, state_vec)
        next_difficulty = int(clamp(current_difficulty + next_delta, min(DIFFICULTY_LEVELS), max(DIFFICULTY_LEVELS)))
        st.pending_state_vec = state_vec.copy()
        st.pending_action = int(next_delta)
        st.last_difficulty = next_difficulty
        return {
            "next_difficulty": next_difficulty,
            "updated_mastery": updated_mastery,
            "reward": reward,
            "chosen_delta": int(next_delta),
            "recent_acc": float(recent_acc),
        }


agent = AdaptiveRLAgent()
