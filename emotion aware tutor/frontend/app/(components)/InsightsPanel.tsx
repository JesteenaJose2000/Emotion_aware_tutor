"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, Activity } from "lucide-react";
import { useSessionStore } from "@/store/session";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useMemo } from "react";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);
import { accuracyChartOptions, engagementChartOptions } from "@/lib/chartConfig";
import { rollingMean, cumulativeSum, mean } from "@/src/lib/metrics";
import { countBy } from "@/src/lib/hist";

export function InsightsPanel() {
  const { 
    accuracyHistory, 
    engagementHistory, 
    rewardHistory, 
    actionHistory,
    difficultyHistory,
    turn
  } = useSessionStore();
  
  // Calculate cumulative reward directly from rewardHistory to ensure reactivity
  const cumulativeReward = useMemo(() => {
    return rewardHistory.reduce((sum, reward) => sum + reward, 0);
  }, [rewardHistory]);
  

  // Memoize chart data to avoid unnecessary re-renders
  const accuracyChartData = useMemo(() => {
    if (accuracyHistory.length === 0) return null;

    const accuracyData = accuracyHistory.map((accuracy, index) => ({
      x: index + 1,
      y: accuracy
    }));

    // Calculate rolling mean using metrics utility
    const rollingMeanData = rollingMean(accuracyHistory, 5).map((mean, index) => ({
      x: index + 1,
      y: mean
    }));

    return {
      datasets: [
        {
          label: "Accuracy",
          data: accuracyData,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: "Rolling Mean",
          data: rollingMeanData,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "transparent",
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    };
  }, [accuracyHistory]);

  const engagementChartData = useMemo(() => {
    if (engagementHistory.length === 0) return null;

    const engagementData = engagementHistory.map((engagement, index) => ({
      x: index + 1,
      y: engagement
    }));

    // Calculate rolling mean using metrics utility
    const rollingMeanData = rollingMean(engagementHistory, 5).map((mean, index) => ({
      x: index + 1,
      y: mean
    }));

    return {
      datasets: [
        {
          label: "Engagement",
          data: engagementData,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: "Rolling Mean (5)",
          data: rollingMeanData,
          borderColor: "rgb(147, 51, 234)",
          backgroundColor: "rgba(147, 51, 234, 0.1)",
          tension: 0.3,
          pointRadius: 1,
          borderDash: [5, 5],
        },
      ],
    };
  }, [engagementHistory]);

  const currentAccuracy = accuracyHistory.length > 0 
    ? mean(accuracyHistory) * 100 
    : 0;
  const currentEngagement = engagementHistory.length > 0 
    ? engagementHistory[engagementHistory.length - 1] * 100 
    : 0;

  if (turn === 0) {
    return (
      <div className="space-y-6">
        <Card className="glass-card">
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <div className="text-4xl">📊</div>
              <p className="text-muted-foreground">Complete a few questions to see insights</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accuracy Chart */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Accuracy Trend
          </CardTitle>
          <CardDescription>
            Performance over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32">
            {accuracyChartData ? (
              <Line data={accuracyChartData} options={accuracyChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No data yet</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current</span>
            <Badge variant={currentAccuracy >= 70 ? "default" : currentAccuracy >= 50 ? "secondary" : "destructive"}>
              {currentAccuracy.toFixed(1)}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Engagement Chart */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Engagement
          </CardTitle>
          <CardDescription>
            Positive vs Frustrated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32">
            {engagementChartData ? (
              <Line data={engagementChartData} options={engagementChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No data yet</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current</span>
            <div className="flex items-center gap-1">
              {currentEngagement >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <Badge variant={currentEngagement >= 0 ? "default" : "destructive"}>
                {currentEngagement.toFixed(1)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Reward */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Cumulative Reward
          </CardTitle>
          <CardDescription>
            Total points earned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-card-foreground">
              {cumulativeReward >= 0 ? "+" : ""}{cumulativeReward.toFixed(1)}
            </div>
            <Badge 
              variant={cumulativeReward >= 0 ? "default" : "destructive"}
              className="text-lg px-3 py-1"
            >
              {cumulativeReward >= 0 ? "Positive" : "Negative"}
            </Badge>
            <div className="text-sm text-muted-foreground">
              {rewardHistory.length} questions answered
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Instrumentation */}
      {turn > 0 && (
        <>
          {/* Action Histogram */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" />
                Action Histogram
              </CardTitle>
              <CardDescription>
                Distribution of actions taken by the policy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionHistory.length > 0 ? (
                <Bar
                  data={{
                    labels: Object.keys(countBy(actionHistory)),
                    datasets: [
                      {
                        label: 'Count',
                        data: Object.values(countBy(actionHistory)),
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No actions recorded yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Difficulty Trend */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                Difficulty Trend
              </CardTitle>
              <CardDescription>
                How difficulty changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {difficultyHistory.length > 0 ? (
                <Line
                  data={{
                    labels: Array.from({ length: difficultyHistory.length }, (_, i) => i + 1),
                    datasets: [
                      {
                        label: 'Difficulty',
                        data: difficultyHistory,
                        borderColor: 'rgb(147, 51, 234)',
                        backgroundColor: 'rgba(147, 51, 234, 0.1)',
                        tension: 0.3,
                        pointRadius: 3,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        min: 1,
                        max: 5,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No difficulty data yet
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
}
