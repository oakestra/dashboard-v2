// Everything is re-exported from the package root on purpose: Module Federation shares
// `@oakestra/ui` by its bare specifier, so deep imports like `@oakestra/ui/components/button`
// would give every addon its own private copy of the component and its React context.
export { Alert, AlertDescription, AlertTitle } from './components/alert';
export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from './components/avatar';
export { Badge, badgeVariants } from './components/badge';
export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './components/breadcrumb';
export { Button, buttonVariants } from './components/button';
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './components/dropdown-menu';
export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from './components/field';
export { Input } from './components/input';
export { Label } from './components/label';
export { RadioGroup, RadioGroupItem } from './components/radio-group';
export { Separator } from './components/separator';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/sheet';
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './components/sidebar';
export { Skeleton } from './components/skeleton';
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './components/table';
export { Toaster, toast } from './components/sonner';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/tooltip';
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './components/accordion';
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './components/alert-dialog';
export { Checkbox } from './components/checkbox';
export {
  CheckboxGroup,
  type CheckboxGroupOption,
  type CheckboxGroupProps,
} from './components/checkbox-group';
export { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/collapsible';
export { ConfirmDialog, type ConfirmDialogProps } from './components/confirm-dialog';
export { EmptyState, type EmptyStateProps } from './components/empty-state';
export { PageHeader, type PageHeaderProps } from './components/page-header';
export { SectionCard, type SectionCardProps } from './components/section-card';
export { StatCard, type StatCardProps } from './components/stat-card';
export {
  StatusBadge,
  StatusDot,
  type StatusBadgeProps,
  type StatusDotProps,
  type StatusTone,
} from './components/status-badge';
export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './components/pagination';
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './components/popover';
export { Progress } from './components/progress';
export { ScrollArea, ScrollBar } from './components/scroll-area';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/select';
export { Switch } from './components/switch';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';
export { Textarea } from './components/textarea';
export { Toggle, toggleVariants } from './components/toggle';
export { ToggleGroup, ToggleGroupItem } from './components/toggle-group';
export { useIsMobile } from './hooks/use-mobile';
export { cn } from './lib/utils';
// Lives in the root export so the host can configure maps at startup without loading the map
// subpath (and its stylesheet) on every page.
export { setMapWorkerUrl } from './lib/map-worker';
export { CopyButton } from './components/copy-button';
export { JsonViewer } from './components/json-viewer';
export { QueryErrorAlert } from './components/query-error-alert';
export { downloadJson, downloadText } from './lib/download';
export {
  BYTES_PER_MB,
  formatBytes,
  formatDate,
  formatDateTime,
  formatLegacyDate,
  formatMegabytes,
  formatPercent,
  formatRelativeTime,
  parseLegacyDate,
  plural,
} from './lib/format';
