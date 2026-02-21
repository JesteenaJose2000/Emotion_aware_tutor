import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
  scales: {
    x: {
      type: 'linear' as const,
      display: true,
      title: {
        display: true,
        text: 'Turn',
      },
      beginAtZero: false,
      ticks: {
        stepSize: 1,
        precision: 0,
      },
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Value',
      },
    },
  },
  elements: {
    point: {
      radius: 2,
    },
    line: {
      tension: 0.3,
    },
  },
};

export const accuracyChartOptions = {
  ...defaultChartOptions,
  scales: {
    ...defaultChartOptions.scales,
    y: {
      ...defaultChartOptions.scales.y,
      min: 0,
      max: 1,
      title: {
        display: true,
        text: 'Accuracy',
      },
    },
  },
};

export const engagementChartOptions = {
  ...defaultChartOptions,
  scales: {
    ...defaultChartOptions.scales,
    y: {
      ...defaultChartOptions.scales.y,
      min: -1,
      max: 1,
      title: {
        display: true,
        text: 'Engagement',
      },
    },
  },
};

