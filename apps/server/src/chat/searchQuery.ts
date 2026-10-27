import { siteHost } from "@sirathic/core/web/url";

const SITE_OPERATOR = /(?:^|[\s(])site:([^\s)]+)/giu;
const QUOTES = /["“”„‟«»]/gu;
const BOOLEAN_OPERATOR = /(?<=^|\s)(?:AND|OR|NOT)(?=\s|$)/gu;

const MIN_QUERY_CHARS = 2;

const cleanQuery = (raw: string) => {
  const bare = raw.replaceAll(QUOTES, " ");
  return {
    query: bare
      .replaceAll(SITE_OPERATOR, " ")
      .replaceAll(BOOLEAN_OPERATOR, " ")
      .replaceAll(/\s+/gu, " ")
      .trim(),
    sites: [...bare.matchAll(SITE_OPERATOR)].map(([, site = ""]) => site),
  };
};

export const cleanSearch = ({
  queries,
  arabic,
  sites,
}: {
  queries: string[];
  arabic: string[];
  sites: string[];
}) => {
  const cleanedQueries = queries.map(cleanQuery);
  const cleanedArabic = arabic.map(cleanQuery);
  const all = [...cleanedQueries, ...cleanedArabic];
  const keep = (list: typeof all) => [
    ...new Set(list.map(({ query }) => query).filter(({ length }) => length >= MIN_QUERY_CHARS)),
  ];
  const named = [...sites, ...all.flatMap((cleaned) => cleaned.sites)];
  const parsed = named.map((site) => ({ site, host: siteHost.safeParse(site) }));
  return {
    queries: keep(cleanedQueries),
    arabic: keep(cleanedArabic),
    sites: [...new Set(parsed.flatMap(({ host }) => (host.success ? [host.data] : [])))],
    notes: [
      ...(all.some(({ query }) => query.length < MIN_QUERY_CHARS)
        ? ["A query was empty after removing quotes and operators, so it was skipped."]
        : []),
      ...parsed.flatMap(({ site, host }) =>
        host.success
          ? []
          : [`"${site}" is not a domain, so it was ignored. Use one like islamqa.info.`],
      ),
    ],
  };
};
