// Subpath entry: recharts is large, so charts stay out of the root `@oakestra/ui` export that every
// page loads. Registered as its own shared module in the SDK's `sharedDeps`.
export {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
  type ChartConfig,
} from './components/chart';
export {
  TimeSeriesChart,
  type TimeSeriesPoint,
  type TimeSeriesUnit,
} from './components/time-series-chart';
