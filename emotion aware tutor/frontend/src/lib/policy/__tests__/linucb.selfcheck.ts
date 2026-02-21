/**
 * LinUCB Self-Check
 * 
 * Lightweight sanity check for LinUCB implementation
 */

import { SeededRNG } from '../../seed';

interface LinUCBContext {
  A: number[][]; // d x d matrix
  b: number[];   // d-dimensional vector
  alpha: number; // confidence parameter
}

class LinUCB {
  private contexts: Map<string, LinUCBContext> = new Map();
  private d: number;

  constructor(d: number, alpha: number = 1.0) {
    this.d = d;
    this.alpha = alpha;
  }

  selectArm(features: number[], armId: string): number {
    const context = this.getOrCreateContext(armId);
    
    // Compute confidence bound
    const AInv = this.inverse(context.A);
    const theta = this.matrixVectorMultiply(AInv, context.b);
    const p = this.dotProduct(theta, features);
    const confidence = this.alpha * Math.sqrt(this.quadraticForm(AInv, features));
    
    return p + confidence;
  }

  update(features: number[], reward: number, armId: string): void {
    const context = this.getOrCreateContext(armId);
    
    // Update A and b
    for (let i = 0; i < this.d; i++) {
      for (let j = 0; j < this.d; j++) {
        context.A[i][j] += features[i] * features[j];
      }
      context.b[i] += features[i] * reward;
    }
  }

  private getOrCreateContext(armId: string): LinUCBContext {
    if (!this.contexts.has(armId)) {
      const A = Array(this.d).fill(null).map(() => Array(this.d).fill(0));
      const b = Array(this.d).fill(0);
      this.contexts.set(armId, { A, b, alpha: this.alpha });
    }
    return this.contexts.get(armId)!;
  }

  private inverse(matrix: number[][]): number[][] {
    // Simple 2x2 matrix inverse for self-check
    if (this.d !== 2) throw new Error('Only 2D supported for self-check');
    
    const [[a, b], [c, d]] = matrix;
    const det = a * d - b * c;
    
    if (Math.abs(det) < 1e-10) {
      // Return identity if singular
      return [[1, 0], [0, 1]];
    }
    
    return [
      [d / det, -b / det],
      [-c / det, a / det]
    ];
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => this.dotProduct(row, vector));
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private quadraticForm(matrix: number[][], vector: number[]): number {
    const mv = this.matrixVectorMultiply(matrix, vector);
    return this.dotProduct(vector, mv);
  }
}

export function runLinucbSelfCheck(): { passed: boolean; note: string } {
  try {
    const rng = new SeededRNG(42); // Fixed seed for reproducibility
    const linucb = new LinUCB(2, 1.0);
    
    // Create synthetic 2-armed bandit
    // Arm 0 is better when features[0] > 0.5
    // Arm 1 is better when features[0] <= 0.5
    const arms = ['arm0', 'arm1'];
    let correctSelections = 0;
    const totalIterations = 200;
    
    for (let i = 0; i < totalIterations; i++) {
      // Generate random features
      const features = [rng.nextFloat(0, 1), rng.nextFloat(0, 1)];
      
      // Determine optimal arm
      const optimalArm = features[0] > 0.5 ? 'arm0' : 'arm1';
      
      // Select arm using LinUCB
      const scores = arms.map(arm => linucb.selectArm(features, arm));
      const selectedArm = arms[scores[0] > scores[1] ? 0 : 1];
      
      // Check if selection is correct
      if (selectedArm === optimalArm) {
        correctSelections++;
      }
      
      // Generate reward (higher for optimal arm)
      const reward = selectedArm === optimalArm ? 
        rng.nextFloat(0.7, 1.0) : rng.nextFloat(0.0, 0.3);
      
      // Update LinUCB
      linucb.update(features, reward, selectedArm);
    }
    
    const accuracy = correctSelections / totalIterations;
    const passed = accuracy > 0.7;
    
    return {
      passed,
      note: `LinUCB accuracy: ${(accuracy * 100).toFixed(1)}% (${correctSelections}/${totalIterations}). ${passed ? 'PASSED' : 'FAILED'} - threshold is 70%`
    };
    
  } catch (error) {
    return {
      passed: false,
      note: `LinUCB self-check failed with error: ${error}`
    };
  }
}

