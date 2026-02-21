"""
Calculate how many correct answers at Level 5 are needed to reach 100% mastery.
"""

# Constants from agent.py
ALPHA = 0.37
DIFFICULTY_WEIGHT_5 = 0.9192635382533815  # Updated value

def update_mastery(current_mastery: float, is_correct: bool, difficulty: int = 5) -> float:
    """EMA-based mastery update (same as agent.py)"""
    w = DIFFICULTY_WEIGHT_5 if difficulty == 5 else 0.0
    effective_correct = (1.0 if is_correct else 0.0) * w
    m_new = (1.0 - ALPHA) * current_mastery + ALPHA * effective_correct
    
    # Allow reaching 1.0 when mastery >= 0.80, correct, and difficulty >= 4
    if is_correct and m_new >= 0.80 and difficulty >= 4:
        m_new = 1.0
    
    return max(0.0, min(1.0, m_new))


def calculate_to_100(starting_mastery: float = 0.0):
    """Calculate questions needed from starting mastery to reach 100%"""
    print("="*70)
    print(f"LEVEL 5 MASTERY CALCULATION")
    print(f"Starting Mastery: {starting_mastery:.1%}")
    print(f"Difficulty 5 Weight: {DIFFICULTY_WEIGHT_5:.6f}")
    print(f"ALPHA: {ALPHA}")
    print("="*70)
    print()
    
    mastery = starting_mastery
    question_num = 0
    
    print(f"{'Question':<10} {'Mastery Before':<18} {'Mastery After':<18} {'Status'}")
    print("-"*70)
    
    milestones = [0.20, 0.40, 0.60, 0.80]
    milestone_reached = {m: False for m in milestones}
    
    while mastery < 1.0:
        question_num += 1
        mastery_before = mastery
        mastery = update_mastery(mastery, is_correct=True, difficulty=5)
        
        # Check milestones
        for milestone in milestones:
            if not milestone_reached[milestone] and mastery >= milestone:
                milestone_reached[milestone] = True
                if milestone == 0.80:
                    print(f"  [*] MILESTONE: {milestone*100:.0f}% reached - will jump to 100% on next correct answer!")
        
        # Show every question until we reach 100%
        if mastery < 1.0:
            print(f"  {question_num:<10} {mastery_before:>6.4f} ({mastery_before:>5.1f}%)   {mastery:>6.4f} ({mastery:>5.1f}%)   Progressing")
        else:
            print(f"  {question_num:<10} {mastery_before:>6.4f} ({mastery_before:>5.1f}%)   {mastery:>6.4f} ({mastery:>5.1f}%)   [ACHIEVED 100%!]")
            break
        
        # Safety check
        if question_num > 50:
            print(f"\n  [WARNING] Exceeded 50 questions without reaching 100%")
            break
    
    print()
    print("="*70)
    print(f"RESULT: {question_num} correct answers at Level 5 needed to reach 100% mastery")
    print(f"Final Mastery: {mastery:.6f} ({mastery*100:.4f}%)")
    print("="*70)
    
    return question_num


def calculate_from_different_starting_points():
    """Calculate from various starting mastery levels"""
    print("\n" + "="*70)
    print("CALCULATION FROM DIFFERENT STARTING POINTS")
    print("="*70 + "\n")
    
    starting_points = [0.0, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70]
    
    results = []
    for start in starting_points:
        mastery = start
        count = 0
        while mastery < 0.80:  # Need to reach 0.80 to trigger 100% rule
            mastery = update_mastery(mastery, is_correct=True, difficulty=5)
            count += 1
            if count > 50:
                break
        
        # Add one more question to trigger the 1.0 rule
        if mastery >= 0.80:
            count += 1
            mastery = 1.0
        
        results.append((start, count, mastery))
    
    print(f"{'Starting Mastery':<20} {'Questions Needed':<20} {'Final Mastery'}")
    print("-"*70)
    for start, count, final in results:
        print(f"{start:>6.1%} ({start:>5.2f})        {count:>3} questions          {final:>6.1%}")


if __name__ == "__main__":
    # Calculate from 0% mastery
    questions_needed = calculate_to_100(starting_mastery=0.0)
    
    # Show calculations from different starting points
    calculate_from_different_starting_points()
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"""
    To reach 100% mastery at Level 5:
    
    - From 0% mastery: {questions_needed} correct answers needed
    - The system will automatically set mastery to 100% when:
      * Mastery reaches >= 80%
      * Student answers correctly
      * At difficulty level 4 or 5
    
    - With the updated weight (0.919), mastery grows faster than before
    - Each correct answer at Level 5 contributes: {ALPHA * DIFFICULTY_WEIGHT_5:.4f} to mastery
    """)


