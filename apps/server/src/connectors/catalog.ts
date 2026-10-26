import { z } from "zod";

const TOOL_NAME_LIMIT = 64;

export const CONNECTOR_IDS = [
  "stophy",
  "notion",
  "todoist",
  "canva",
  "buffer",
  "calendly",
  "evernote",
  "airtable",
  "zapier",
  "atlassian",
  "monday",
  "clickup",
  "miro",
  "granola",
  "fireflies",
  "calcom",
  "otter",
  "coda",
  "mem",
  "make",
  "pipedream",
  "typefully",
  "metricool",
  "attio",
  "intercom",
  "customerio",
  "paypal",
  "square",
  "klaviyo",
  "beehiiv",
  "jotform",
  "webflow",
  "wix",
  "ahrefs",
  "semrush",
  "linear",
  "vercel",
  "supabase",
  "cloudflare",
  "neon",
  "sentry",
  "posthog",
  "railway",
  "stripe",
  "parallel",
  "tavily",
  "apify",
  "exa",
  "context7",
  "huggingface",
] as const;

export const connectorId = z.enum(CONNECTOR_IDS);

export type ConnectorId = z.infer<typeof connectorId>;

const customId = z.string().regex(/^custom-[a-z0-9]{8}$/u);

export const pluginId = z.union([connectorId, customId]);

export const newCustomId = () => `custom-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;

export const CATEGORIES = [
  "productivity",
  "automation",
  "search",
  "developer",
  "analytics",
  "finance",
  "marketing",
  "sales",
  "social",
  "design",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CONNECTORS = {
  stophy: {
    name: "Stophy",
    category: "search",
    description: "Get live, structured web data",
    url: "https://mcp.stophy.dev/mcp",
  },
  notion: {
    name: "Notion",
    category: "productivity",
    description: "Search and edit pages and databases",
    url: "https://mcp.notion.com/mcp",
  },
  todoist: {
    name: "Todoist",
    category: "productivity",
    description: "Manage tasks and projects",
    url: "https://ai.todoist.net/mcp",
  },
  canva: {
    name: "Canva",
    category: "design",
    description: "Create, edit and export designs",
    url: "https://mcp.canva.com/mcp",
  },
  buffer: {
    name: "Buffer",
    category: "social",
    description: "Schedule posts and read analytics",
    url: "https://mcp.buffer.com/mcp",
    tokenAuth: "none",
  },
  calendly: {
    name: "Calendly",
    category: "productivity",
    description: "Check availability and book meetings",
    url: "https://mcp.calendly.com",
  },
  evernote: {
    name: "Evernote",
    category: "productivity",
    description: "Search, create and edit notes",
    url: "https://mcp.evernote.com/mcp",
  },
  airtable: {
    name: "Airtable",
    category: "productivity",
    description: "Read and update your bases",
    url: "https://mcp.airtable.com/mcp",
  },
  zapier: {
    name: "Zapier",
    category: "automation",
    description: "Run actions in thousands of apps",
    url: "https://mcp.zapier.com/api/mcp/mcp",
  },
  atlassian: {
    name: "Atlassian",
    category: "productivity",
    description: "Work with Jira and Confluence",
    url: "https://mcp.atlassian.com/v1/mcp",
  },
  monday: {
    name: "monday.com",
    category: "productivity",
    description: "Read and update boards and items",
    url: "https://mcp.monday.com/mcp",
  },
  clickup: {
    name: "ClickUp",
    category: "productivity",
    description: "Manage tasks, docs and time",
    url: "https://mcp.clickup.com/mcp",
  },
  miro: {
    name: "Miro",
    category: "design",
    description: "Create diagrams on your boards",
    url: "https://mcp.miro.com/",
  },
  granola: {
    name: "Granola",
    category: "productivity",
    description: "Search your meeting notes",
    url: "https://mcp.granola.ai/mcp",
  },
  fireflies: {
    name: "Fireflies",
    category: "productivity",
    description: "Search meeting transcripts and summaries",
    url: "https://api.fireflies.ai/mcp",
  },
  calcom: {
    name: "Cal.com",
    category: "productivity",
    description: "Manage bookings and schedules",
    url: "https://mcp.cal.com/mcp",
  },
  otter: {
    name: "Otter",
    category: "productivity",
    description: "Search meeting transcripts and summaries",
    url: "https://mcp.otter.ai/mcp",
  },
  coda: {
    name: "Coda",
    category: "productivity",
    description: "Read and write your docs",
    url: "https://coda.io/apis/mcp",
  },
  mem: {
    name: "Mem",
    category: "productivity",
    description: "Capture and search your notes",
    url: "https://mcp.mem.ai/mcp",
  },
  make: {
    name: "Make",
    category: "automation",
    description: "Build and run automations",
    url: "https://mcp.make.com",
    tokenAuth: "client_secret_post",
  },
  pipedream: {
    name: "Pipedream",
    category: "automation",
    description: "Run actions in thousands of apps",
    url: "https://mcp.pipedream.net/v2",
  },
  typefully: {
    name: "Typefully",
    category: "social",
    description: "Write and schedule social posts",
    url: "https://mcp.typefully.com/mcp",
  },
  metricool: {
    name: "Metricool",
    category: "social",
    description: "Schedule posts and read analytics",
    url: "https://ai.metricool.com/mcp",
  },
  attio: {
    name: "Attio",
    category: "sales",
    description: "Search and update CRM records",
    url: "https://mcp.attio.com/mcp",
  },
  intercom: {
    name: "Intercom",
    category: "sales",
    description: "Read conversations and contacts",
    url: "https://mcp.intercom.com/mcp",
  },
  customerio: {
    name: "Customer.io",
    category: "marketing",
    description: "Manage segments and campaigns",
    url: "https://mcp.customer.io/mcp",
  },
  paypal: {
    name: "PayPal",
    category: "finance",
    description: "Use your PayPal account",
    url: "https://mcp.paypal.com/mcp",
  },
  square: {
    name: "Square",
    category: "finance",
    description: "Use the Square API",
    url: "https://mcp.squareup.com/mcp",
  },
  klaviyo: {
    name: "Klaviyo",
    category: "marketing",
    description: "Build campaigns and read reports",
    url: "https://mcp.klaviyo.com/mcp",
  },
  beehiiv: {
    name: "beehiiv",
    category: "marketing",
    description: "Manage newsletters and subscribers",
    url: "https://mcp.beehiiv.com/mcp",
  },
  jotform: {
    name: "Jotform",
    category: "productivity",
    description: "Build forms and read submissions",
    url: "https://mcp.jotform.com/",
  },
  webflow: {
    name: "Webflow",
    category: "design",
    description: "Design and manage your sites",
    url: "https://mcp.webflow.com/mcp",
  },
  wix: {
    name: "Wix",
    category: "design",
    description: "Build and manage Wix sites",
    url: "https://mcp.wix.com/mcp",
  },
  ahrefs: {
    name: "Ahrefs",
    category: "marketing",
    description: "Look up SEO and backlink data",
    url: "https://api.ahrefs.com/mcp/mcp",
  },
  semrush: {
    name: "Semrush",
    category: "marketing",
    description: "Look up SEO and traffic data",
    url: "https://mcp.semrush.com/v2/mcp",
  },
  linear: {
    name: "Linear",
    category: "productivity",
    description: "Track issues and projects",
    url: "https://mcp.linear.app/mcp",
  },
  vercel: {
    name: "Vercel",
    category: "developer",
    description: "Check deployments and logs",
    url: "https://mcp.vercel.com",
  },
  supabase: {
    name: "Supabase",
    category: "developer",
    description: "Query databases and manage projects",
    url: "https://mcp.supabase.com/mcp",
  },
  cloudflare: {
    name: "Cloudflare",
    category: "developer",
    description: "Manage Workers, DNS and more",
    url: "https://mcp.cloudflare.com/mcp",
  },
  neon: {
    name: "Neon",
    category: "developer",
    description: "Manage Postgres projects",
    url: "https://mcp.neon.tech/mcp",
  },
  sentry: {
    name: "Sentry",
    category: "developer",
    description: "Look up errors and issues",
    url: "https://mcp.sentry.dev/mcp",
  },
  posthog: {
    name: "PostHog",
    category: "analytics",
    description: "Query product analytics",
    url: "https://mcp.posthog.com/mcp",
  },
  railway: {
    name: "Railway",
    category: "developer",
    description: "Deploy and debug services",
    url: "https://mcp.railway.com",
  },
  stripe: {
    name: "Stripe",
    category: "finance",
    description: "Manage customers and payments",
    url: "https://mcp.stripe.com",
  },
  parallel: {
    name: "Parallel",
    category: "search",
    description: "Search the web",
    url: "https://search-mcp.parallel.ai/mcp",
  },
  tavily: {
    name: "Tavily",
    category: "search",
    description: "Search the web",
    url: "https://mcp.tavily.com/mcp",
  },
  apify: {
    name: "Apify",
    category: "search",
    description: "Extract data from websites",
    url: "https://mcp.apify.com",
  },
  exa: {
    name: "Exa",
    category: "search",
    description: "Search and crawl the web",
    url: "https://mcp.exa.ai/mcp",
    open: true,
  },
  context7: {
    name: "Context7",
    category: "developer",
    description: "Get up-to-date code docs",
    url: "https://mcp.context7.com/mcp",
    open: true,
  },
  huggingface: {
    name: "Hugging Face",
    category: "developer",
    description: "Search models, datasets and Spaces",
    url: "https://huggingface.co/mcp",
    open: true,
  },
} as const satisfies Record<
  ConnectorId,
  {
    name: string;
    category: Category;
    description: string;
    url: string;
    open?: true;
    tokenAuth?: "none" | "client_secret_post";
  }
>;

const POPULAR_SIZE = 6;
const POPULAR_MIN_USERS = 3;

export const popularOf = (counts: readonly { connector: string; users: number }[]) =>
  new Set(
    counts
      .filter((row) => row.users >= POPULAR_MIN_USERS)
      .toSorted((a, b) => b.users - a.users || a.connector.localeCompare(b.connector))
      .slice(0, POPULAR_SIZE)
      .map((row) => row.connector),
  );

export const toolName = (connector: string, name: string) =>
  `${connector}_${name}`.replaceAll(/[^\w-]/gu, "_").slice(0, TOOL_NAME_LIMIT);
