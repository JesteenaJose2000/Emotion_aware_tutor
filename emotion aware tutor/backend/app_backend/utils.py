import random
from typing import Tuple, Dict, Any, Optional


def clamp(x: float, min_val: float, max_val: float) -> float:
    """Clamp a numeric value to the [min_val, max_val] range."""
    return max(min_val, min(x, max_val))


def generate_math_question(concept: str, difficulty: int) -> Tuple[str, int, str]:
    """Generate a math question based purely on difficulty.

    Returns:
        (question_text, correct_answer, hint)

    Difficulty levels:
        1. One‑ or two‑digit addition
        2. One‑ or two‑digit addition and subtraction
        3. One‑digit multiplication, plus three‑digit addition/subtraction
        4. Division with whole‑number answers and 2‑digit multiplication
        5. Mix of division, multiplication, and 3‑digit addition/subtraction

    The ``concept`` argument is currently ignored but kept for backwards
    compatibility with existing API calls.
    """
    difficulty = int(clamp(difficulty, 1, 5))

    def one_or_two_digit() -> int:
        # Randomly choose between 1‑digit [1–9] and 2‑digit [10–99]
        if random.random() < 0.5:
            return random.randint(1, 9)
        return random.randint(10, 99)

    def three_digit() -> int:
        return random.randint(100, 999)

    op_type: str

    if difficulty == 1:
        # Only addition with small numbers
        op_type = "add_1_2_digit"
    elif difficulty == 2:
        # Addition or subtraction with small numbers
        op_type = random.choice(["add_1_2_digit", "sub_1_2_digit"])
    elif difficulty == 3:
        # Mix of simple multiplication and 3‑digit +/- questions
        op_type = random.choice(
            ["mul_1_digit", "add_3_digit", "sub_3_digit"]
        )
    elif difficulty == 4:
        # Division or 2‑digit multiplication
        op_type = random.choice(["div_easy", "mul_2_digit"])
    else:  # difficulty == 5
        # Rich mix of division, multiplication, and 3‑digit +/- questions
        op_type = random.choice(
            ["div_hard", "mul_2_digit", "mul_3_digit", "add_3_digit", "sub_3_digit"]
        )

    # Build the actual question based on op_type
    if op_type == "add_1_2_digit":
        a = one_or_two_digit()
        b = one_or_two_digit()
        question = f"{a} + {b} = ?"
        answer = a + b
        hint = "Add the two numbers. You can add the ones first, then the tens."
    elif op_type == "sub_1_2_digit":
        a = one_or_two_digit()
        b = one_or_two_digit()
        # ensure non‑negative result
        a, b = max(a, b), min(a, b)
        question = f"{a} - {b} = ?"
        answer = a - b
        hint = "Subtract the smaller number from the larger. Think in terms of 'how much more?'."
    elif op_type == "mul_1_digit":
        a = random.randint(1, 9)
        b = random.randint(1, 9)
        question = f"{a} × {b} = ?"
        answer = a * b
        hint = "Use repeated addition or a times table to multiply the two one‑digit numbers."
    elif op_type == "add_3_digit":
        a = three_digit()
        b = three_digit()
        question = f"{a} + {b} = ?"
        answer = a + b
        hint = "Line up hundreds, tens, and ones, then add column by column."
    elif op_type == "sub_3_digit":
        a = three_digit()
        b = three_digit()
        # ensure non‑negative result
        a, b = max(a, b), min(a, b)
        question = f"{a} - {b} = ?"
        answer = a - b
        hint = "Subtract each place value (hundreds, tens, ones). Borrow if needed."
    elif op_type == "mul_2_digit":
        a = random.randint(10, 99)
        b = random.randint(10, 99)
        question = f"{a} × {b} = ?"
        answer = a * b
        hint = "Use long multiplication: multiply by the ones digit, then the tens digit, then add."
    elif op_type == "mul_3_digit":
        a = random.randint(10, 99)
        b = random.randint(100, 999)
        question = f"{a} × {b} = ?"
        answer = a * b
        hint = "Break one number into tens and ones (or hundreds) and use long multiplication."
    elif op_type == "div_easy":
        # Small‑number division with whole‑number answers
        divisor = random.randint(2, 9)
        quotient = random.randint(2, 12)
        dividend = divisor * quotient
        question = f"{dividend} ÷ {divisor} = ?"
        answer = quotient
        hint = "Think: what number times the divisor gives the dividend?"
    elif op_type == "div_hard":
        # Larger integer division with whole‑number answers
        divisor = random.randint(2, 20)
        quotient = random.randint(5, 50)
        dividend = divisor * quotient
        question = f"{dividend} ÷ {divisor} = ?"
        answer = quotient
        hint = "Use long division. Divide, multiply, subtract, then bring down the next digit."
    else:
        # Fallback to simple addition if something unexpected happens
        a = one_or_two_digit()
        b = one_or_two_digit()
        question = f"{a} + {b} = ?"
        answer = a + b
        hint = "Add the two numbers."

    return question, answer, hint


# ----- Placeholders for future AI modules -----

# DIFFICULTY_WEIGHT = {
#     1: 0.10,   # very small impact
#     2: 0.20,
#     3: 0.40,
#     4: 0.70,
#     5: 1.00,   # full impact
# }


# ALPHA = 0.2

# ALPHA = 0.2

# def update_mastery(current_mastery: float, is_correct: bool, difficulty: int) -> float:
#     """
#     EMA-based mastery update with difficulty weighting.
#     mastery ∈ [0,1]
#     is_correct ∈ {False,True}
#     difficulty ∈ {1,2,3,4,5}
#     """
#     # weight correctness based on difficulty
#     w = DIFFICULTY_WEIGHT.get(difficulty, 0.0)

#     # correctness signal scaled by difficulty
#     effective_correct = (1.0 if is_correct else 0.0) * w

#     # EMA update
#     m_new = (1.0 - ALPHA) * current_mastery + ALPHA * effective_correct

#     return clamp(m_new, 0.0, 1.0)


def mastery_to_difficulty_linear(mastery: float) -> int:
    # 0.0 -> 1, 1.0 -> 5
    m = clamp(mastery, 0.0, 1.0)
    diff = 1 + int(m * 4)     # 0..4 → 1..5
    return int(clamp(diff, 1, 5))


# Alias for convenience
mastery_to_difficulty = mastery_to_difficulty_linear



# def choose_next_action(current_difficulty: int, is_correct: bool) -> int:
#     """Placeholder for RL policy; returns difficulty delta based on correctness.

#     Replace with contextual bandit or RL policy later.
#     """
#     return 1 if is_correct else -1


def choose_next_difficulty(mastery: float) -> int:
    """Choose next difficulty purely from mastery (no RL yet)."""
    return mastery_to_difficulty(mastery)



def shape_reward(is_correct: bool) -> float:
    """Simple reward shaping; replace with richer function later."""
    return 1.0 if is_correct else -0.5


def fuse_emotions(
    fer: Dict[str, float],
    ser: Optional[Dict[str, float]] = None,
    ser_vad: Optional[float] = None,
    lambda_weight: float = 0.6,
    min_vad: float = 0.2,
) -> Dict[str, float]:
    """
    Fuse FER (Facial Emotion Recognition) and SER (Speech Emotion Recognition) emotions.
    
    Args:
        fer: Dict with keys "positive", "neutral", "frustrated" (FER values)
        ser: Optional dict with keys "positive", "neutral", "frustrated" (SER values)
        ser_vad: Optional Voice Activity Detection value (0-1)
        lambda_weight: Weight for FER in fusion (0-1). Default 0.6 means 60% FER, 40% SER
        min_vad: Minimum VAD threshold to use SER. If VAD < min_vad, use FER only
    
    Returns:
        Dict with "positive" and "frustrated" probabilities (normalized)
    """
    # If no SER data or VAD too low, use FER only
    if ser is None or ser_vad is None or ser_vad < min_vad:
        return {
            "positive": float(fer.get("positive", 0.0)),
            "frustrated": float(fer.get("frustrated", 0.0)),
        }
    
    # Extract values with defaults
    fer_pos = float(fer.get("positive", 0.0))
    fer_neu = float(fer.get("neutral", 0.0))
    fer_fru = float(fer.get("frustrated", 0.0))
    
    ser_pos = float(ser.get("positive", 0.0))
    ser_neu = float(ser.get("neutral", 0.0))
    ser_fru = float(ser.get("frustrated", 0.0))
    
    # Fuse: lambda * FER + (1 - lambda) * SER
    fused_pos = lambda_weight * fer_pos + (1 - lambda_weight) * ser_pos
    fused_neu = lambda_weight * fer_neu + (1 - lambda_weight) * ser_neu
    fused_fru = lambda_weight * fer_fru + (1 - lambda_weight) * ser_fru
    
    # Renormalize to ensure probabilities sum to 1
    total = fused_pos + fused_neu + fused_fru
    if total > 0:
        fused_pos /= total
        fused_neu /= total
        fused_fru /= total
    else:
        # Fallback to uniform if all zeros
        fused_pos = fused_neu = fused_fru = 1.0 / 3.0
    
    # Return only positive and frustrated (as expected by agent)
    return {
        "positive": clamp(fused_pos, 0.0, 1.0),
        "frustrated": clamp(fused_fru, 0.0, 1.0),
    }

