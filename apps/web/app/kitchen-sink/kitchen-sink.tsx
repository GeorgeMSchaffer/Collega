"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarStack,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  DeniedAction,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Empty,
  EmptyDescription,
  EmptyTitle,
  ForRoles,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorDescription,
  InspectorFooter,
  InspectorHeader,
  InspectorLayout,
  InspectorTitle,
  Kbd,
  Label,
  Pagination,
  PaginationNext,
  PaginationPrevious,
  RadioGroup,
  RadioGroupItem,
  RoleProvider,
  ScrollArea,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInsetHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarOrg,
  SidebarProvider,
  SidebarTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  When,
  type ScreenState,
  useForm,
  zodResolver,
} from "@collega/design-system";
import * as React from "react";
import { z } from "zod";

/**
 * Every primitive in the design system, rendered against the comp Q tokens.
 *
 * Kept rather than deleted: E0 is frozen and six screen slices build on it, so a single
 * page that renders the whole set at once is how a regression in the frozen package gets
 * noticed, and how a screen author checks what a primitive actually looks like. It ships
 * with the app on purpose — Collega has no public surface, and a deployed preview is
 * where the design gets reviewed.
 */

const ideaSchema = z.object({
  title: z.string().min(3, "Give the idea a title of at least 3 characters."),
});

function IdeaForm() {
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof ideaSchema>>({
    resolver: zodResolver(ideaSchema),
    defaultValues: { title: "" },
  });

  return (
    <Form {...form}>
      <form
        className="w-80"
        data-testid="idea-form"
        onSubmit={form.handleSubmit((values) => setSubmitted(values.title))}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Idea title</FormLabel>
              <FormControl>
                <Input placeholder="Battery telemetry export" {...field} />
              </FormControl>
              <FormDescription>
                Enter submits, no button needed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm">
          Capture
        </Button>
        {submitted && (
          <p
            data-testid="idea-form-result"
            className="mt-2 text-sm text-muted-foreground"
          >
            Captured: {submitted}
          </p>
        )}
      </form>
    </Form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

export function KitchenSink() {
  const [state, setState] = React.useState<ScreenState>("normal");
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [inspectorOpen, setInspectorOpen] = React.useState(true);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              CO
            </span>
            Collega
          </SidebarHeader>
          <SidebarOrg>Acme Robotics</SidebarOrg>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Work</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    Home <SidebarMenuBadge>12</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    Ideas <SidebarMenuBadge>44</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>Boards</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Avatar>
              <AvatarFallback>AK</AvatarFallback>
            </Avatar>
            <span>
              Ada Kowalski
              <span className="block text-xs text-muted-foreground">
                Org admin
              </span>
            </span>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <SidebarInsetHeader>
            <SidebarTrigger />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Collega</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Component reference</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
              >
                Search <Kbd>⌘K</Kbd>
              </Button>
              <Button size="sm">New idea</Button>
            </div>
          </SidebarInsetHeader>

          <InspectorLayout
            open={inspectorOpen}
            inspector={
              <Inspector aria-label="Idea inspector">
                <InspectorHeader>
                  <div className="min-w-0">
                    <InspectorTitle>Battery telemetry export</InspectorTitle>
                    <InspectorDescription>
                      IDEA-118 · updated 2 days ago
                    </InspectorDescription>
                  </div>
                  <InspectorClose onClick={() => setInspectorOpen(false)} />
                </InspectorHeader>
                <InspectorBody>
                  <p className="m-0 text-sm leading-relaxed">
                    A docked column, not a Sheet: the board behind it stays
                    readable and operable, and focus is never trapped. Drag the
                    divider to resize it.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">Fleet</Badge>
                    <Badge variant="outline">Q3</Badge>
                    <Badge variant="suggested">Suggested</Badge>
                  </div>
                </InspectorBody>
                <InspectorFooter>
                  <Button size="sm">Save</Button>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </InspectorFooter>
              </Inspector>
            }
          >
            <div className="min-w-0 flex-1 overflow-y-auto">
              <div className="max-w-[1320px] p-6">
                <h1 className="mb-1">Component reference</h1>
                <p className="text-muted-foreground">
                  Every primitive in <code>@collega/design-system</code>, on the
                  comp Q tokens: <code>--radius: 0.3rem</code>, the 2026-08-31
                  palette, Geist.
                </p>

                <Section title="Button">
                  <Button>Primary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="warn">Archive</Button>
                  <Button variant="destructive">Delete</Button>
                  <Button variant="link">Clear</Button>
                  <Button size="sm">Small</Button>
                  <Button size="icon" aria-label="More">
                    +
                  </Button>
                  <Button disabled>Disabled</Button>
                </Section>

                <Section title="Badge and key">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Blocked</Badge>
                  <Badge variant="warning">At risk</Badge>
                  <Badge variant="suggested">Suggested</Badge>
                  <Badge variant="mono">IDEA-118</Badge>
                  <Kbd>⌘K</Kbd>
                </Section>

                <Section title="Avatar">
                  <Avatar>
                    <AvatarFallback>AK</AvatarFallback>
                  </Avatar>
                  <AvatarStack aria-label="Three assignees">
                    <Avatar>
                      <AvatarFallback>AK</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>PM</AvatarFallback>
                    </Avatar>
                  </AvatarStack>
                </Section>

                <Section title="Card">
                  <Card className="w-72">
                    <CardHeader>
                      <CardTitle>Sprint 12</CardTitle>
                      <CardDescription>Closes 19 September</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="m-0 text-sm text-muted-foreground">
                        18 of 26 points complete.
                      </p>
                    </CardContent>
                  </Card>
                  <Empty className="w-72">
                    <EmptyTitle>No ideas yet</EmptyTitle>
                    <EmptyDescription>
                      Capture the first one and it will show up here.
                    </EmptyDescription>
                  </Empty>
                </Section>

                <Section title="Alert">
                  <Alert className="w-full max-w-lg">
                    <AlertTitle>Heads up</AlertTitle>
                    <AlertDescription>The default advisory.</AlertDescription>
                  </Alert>
                  <Alert variant="warning" className="w-full max-w-lg">
                    <AlertTitle>Session expiring</AlertTitle>
                    <AlertDescription>
                      You will be signed out in 2 minutes.
                    </AlertDescription>
                  </Alert>
                  <Alert variant="destructive" className="w-full max-w-lg">
                    <AlertTitle>Could not save</AlertTitle>
                    <AlertDescription>
                      The title is already in use.
                    </AlertDescription>
                  </Alert>
                </Section>

                <Section title="Form controls">
                  <div className="w-64">
                    <Label htmlFor="ks-title">Title</Label>
                    <Input
                      id="ks-title"
                      placeholder="Battery telemetry export"
                    />
                  </div>
                  <div className="w-64">
                    <Label htmlFor="ks-notes">Notes</Label>
                    <Textarea
                      id="ks-notes"
                      placeholder="Anything worth knowing"
                    />
                  </div>
                  <div className="w-56">
                    <Label htmlFor="ks-status">Status</Label>
                    <Select>
                      <SelectTrigger id="ks-status">
                        <SelectValue placeholder="Choose a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="triage">In triage</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="ks-mine" />
                    <Label htmlFor="ks-mine" className="mb-0">
                      Only mine
                    </Label>
                  </div>
                  <RadioGroup defaultValue="high" aria-label="Priority">
                    <span className="flex items-center gap-2">
                      <RadioGroupItem value="high" id="ks-high" />
                      <Label htmlFor="ks-high" className="mb-0">
                        High
                      </Label>
                    </span>
                    <span className="flex items-center gap-2">
                      <RadioGroupItem value="low" id="ks-low" />
                      <Label htmlFor="ks-low" className="mb-0">
                        Low
                      </Label>
                    </span>
                  </RadioGroup>
                </Section>

                <Section title="Form (react-hook-form + zod)">
                  <IdeaForm />
                </Section>

                <Section title="Tabs, toggles, separator">
                  <Tabs defaultValue="board" className="w-80">
                    <TabsList>
                      <TabsTrigger value="board">Board</TabsTrigger>
                      <TabsTrigger value="list">List</TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="board"
                      className="text-sm text-muted-foreground"
                    >
                      Lanes and cards.
                    </TabsContent>
                    <TabsContent
                      value="list"
                      className="text-sm text-muted-foreground"
                    >
                      A table of ideas.
                    </TabsContent>
                  </Tabs>
                  <Toggle aria-label="Only mine">Only mine</Toggle>
                  <ToggleGroup
                    type="single"
                    defaultValue="week"
                    aria-label="Range"
                  >
                    <ToggleGroupItem value="week">Week</ToggleGroupItem>
                    <ToggleGroupItem value="month">Month</ToggleGroupItem>
                  </ToggleGroup>
                  <Separator orientation="vertical" className="h-8" />
                </Section>

                <Section title="Table and pagination">
                  <Card className="w-full max-w-2xl gap-0 overflow-hidden py-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <Badge variant="mono">IDEA-118</Badge>
                          </TableCell>
                          <TableCell>Battery telemetry export</TableCell>
                          <TableCell>
                            <Badge variant="secondary">In triage</Badge>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <Badge variant="mono">IDEA-119</Badge>
                          </TableCell>
                          <TableCell>Bulk reassign</TableCell>
                          <TableCell>
                            <Badge variant="outline">New</Badge>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <Pagination>
                      <span>1–2 of 44</span>
                      <span className="ml-auto flex gap-2">
                        <PaginationPrevious />
                        <PaginationNext />
                      </span>
                    </Pagination>
                  </Card>
                </Section>

                <Section title="Dialog, sheet, command palette, tooltip">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Open dialog</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Promote to delivery</DialogTitle>
                        <DialogDescription>
                          This creates an issue on the delivery board.
                        </DialogDescription>
                      </DialogHeader>
                      <Label htmlFor="ks-dlg">Issue title</Label>
                      <Input
                        id="ks-dlg"
                        defaultValue="Battery telemetry export"
                      />
                      <DialogFooter>
                        <Button variant="ghost">Cancel</Button>
                        <Button>Promote</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline">Open sheet</Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Filters</SheetTitle>
                        <SheetDescription>Narrow the list.</SheetDescription>
                      </SheetHeader>
                      <div className="p-6">
                        <Label htmlFor="ks-sheet">Search</Label>
                        <Input id="ks-sheet" placeholder="Title contains…" />
                      </div>
                    </SheetContent>
                  </Sheet>

                  <Button
                    variant="outline"
                    onClick={() => setPaletteOpen(true)}
                  >
                    Open palette
                  </Button>
                  <CommandDialog
                    open={paletteOpen}
                    onOpenChange={setPaletteOpen}
                  >
                    <CommandInput placeholder="Type a command or search…" />
                    <CommandList>
                      <CommandEmpty>Nothing matches.</CommandEmpty>
                      <CommandGroup heading="Go to">
                        <CommandItem>
                          Ideas <CommandShortcut>G I</CommandShortcut>
                        </CommandItem>
                        <CommandItem>
                          Boards <CommandShortcut>G B</CommandShortcut>
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                    <CommandFooter>
                      <span>
                        <Kbd>↵</Kbd> open
                      </span>
                      <span>
                        <Kbd>esc</Kbd> close
                      </span>
                    </CommandFooter>
                  </CommandDialog>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Help">
                        ?
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Points are estimated, not tracked.
                    </TooltipContent>
                  </Tooltip>
                </Section>

                <Section title="Inline command list">
                  <Card className="w-80 py-0">
                    <Command>
                      <CommandInput placeholder="Filter people…" />
                      <CommandList>
                        <CommandEmpty>No matches.</CommandEmpty>
                        <CommandGroup heading="Assignees">
                          <CommandItem>Ada Kowalski</CommandItem>
                          <CommandItem>Jonah Devi</CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </Card>
                </Section>

                <Section title="Denied action and role gating">
                  <RoleProvider role="ReadOnly">
                    <DeniedAction reason="Administrators only">
                      {(denied) => (
                        <Button variant="outline" {...denied}>
                          Add status
                        </Button>
                      )}
                    </DeniedAction>
                    <ForRoles roles={["SiteAdmin", "OrgAdmin"]}>
                      <Button>Only an admin sees this</Button>
                    </ForRoles>
                    <ForRoles roles={["ReadOnly"]}>
                      <span className="text-sm text-muted-foreground">
                        Viewing as ReadOnly.
                      </span>
                    </ForRoles>
                  </RoleProvider>
                </Section>

                <Section title="Screen states">
                  <ToggleGroup
                    type="single"
                    value={state}
                    onValueChange={(v) => v && setState(v as ScreenState)}
                    aria-label="Screen state"
                  >
                    <ToggleGroupItem value="normal">normal</ToggleGroupItem>
                    <ToggleGroupItem value="empty">empty</ToggleGroupItem>
                    <ToggleGroupItem value="loading">loading</ToggleGroupItem>
                    <ToggleGroupItem value="error">error</ToggleGroupItem>
                  </ToggleGroup>
                  <Screen state={state} className="w-full max-w-lg">
                    <When state="normal">
                      <Card>
                        <CardHeader>
                          <CardTitle>44 ideas</CardTitle>
                          <CardDescription>
                            Everything is loaded.
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </When>
                    <When state="empty">
                      <Empty>
                        <EmptyTitle>No ideas yet</EmptyTitle>
                        <EmptyDescription>
                          Capture the first one.
                        </EmptyDescription>
                      </Empty>
                    </When>
                    <When state="loading">
                      <Card>
                        <CardContent>
                          <span className="sr-only">Loading ideas</span>
                          <Skeleton className="w-[60%]" />
                          <Skeleton className="mt-2 w-[80%]" />
                          <Skeleton className="mt-2 w-[40%]" />
                        </CardContent>
                      </Card>
                    </When>
                    <When state="error">
                      <Alert variant="destructive">
                        <AlertTitle>Could not load ideas</AlertTitle>
                        <AlertDescription>
                          Try again in a moment.
                        </AlertDescription>
                      </Alert>
                    </When>
                  </Screen>
                </Section>

                <Section title="Scroll area">
                  <ScrollArea className="h-40 w-72 rounded-lg border bg-card">
                    <ul className="m-0 list-none p-3 text-sm">
                      {Array.from({ length: 14 }, (_, i) => (
                        <li key={i} className="border-b py-1.5 last:border-0">
                          Idea {118 + i}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </Section>

                <Section title="Docked inspector">
                  <Button
                    variant="outline"
                    onClick={() => setInspectorOpen((o) => !o)}
                  >
                    {inspectorOpen ? "Close inspector" : "Open inspector"}
                  </Button>
                </Section>
              </div>
            </div>
          </InspectorLayout>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
