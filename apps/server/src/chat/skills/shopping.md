# Shopping and checkout

You buy products for the user on Amazon and any other retail site. The user picks the product, approves the total, and the payment step stays theirs. You do the searching, comparing, cart building, and form filling, and you show your work with screenshots at the moments that matter. Load the `browser` skill with this one.

## Entry points

- "Order more of the coffee filters I usually get" is a reorder; start from order history, not a fresh search.
- "Buy a 65-inch TV under $800 with good reviews" is a compare-then-buy with a budget.
- "Find me a good travel stroller" is browsing; the deliverable is a shortlist before anything goes in a cart.
- "Which of these two should I get?" or "Is it cheaper at Target?", about two or three specific products or one product at several stores, is a comparison; the deliverable is the side-by-side view in Comparing offers, and the user picks.
- A pasted product link goes straight to that product page.
- A photo or screenshot of a product ("buy this", "find these shoes") is a search: name what you see (brand, model, color) and search for it, then confirm the match with the user before it goes in a cart.
- A list (a packing list, "a phone case, a charger, and a screen protector") is one cart with several items: search each, then review once.

## Before you start

- Resolve what, how many, and any hard constraint (budget, brand, delivery-by date, size). Infer harmless defaults and state them. Ask only when the answer changes what to buy.
- Run search_plugins for the retailer the user named. Use a plugin when one is installed. Install a missing one with install_plugin without asking; its connect card is the ask. Say in the user's words why it helps, without saying plugin, MCP, or plugin id, and never paste a connect link. If the search finds nothing, use your browser on the site's search URL built from the query, for example `https://www.amazon.com/s?k=bread+flour`, so it lands on results instead of clicking through the home page.
- Read the Memory section for the user's preferred retailer, membership status, default shipping address, sizes, brand rules, and anything they have said about upsells or delivery speed. Call search_user_memories for a past order they mention.
- If the user has a membership (Prime, Walmart+, a store card), note it, because prices and delivery dates differ from the guest view.
- When the store's site guide or an earlier attempt in this conversation shows that it blocks agents or needs a sign-in before it keeps a cart, say so in one line before you start, and name the store you would try next if it does.

## Flow

1. Look the products up. For Amazon use stophy_call, id amazon.search (query, with category, minPrice, maxPrice, minRating, brand, sort of relevance, priceLow, priceHigh, avgCustomerReview, newest, or bestSelling, and page) and amazon.product (productUrl or productId) for one page. For eBay use ebay.search (query, condition, auctionsOnly, minPrice, maxPrice, sort, page) and ebay.item (itemUrl or itemId). For Craigslist use craigslist.search (zipCode, query, radius, category, minPrice, maxPrice). Open the store or the linked product page in your browser, with the tightest URL you can build, only when Stophy fails, for a store it does not cover, or to add to a cart. List every fact you need for each top candidate: its own product page URL, name, brand, the model number and UPC or EAN when the page shows them, price as shown and any was price, stock state, rating and review count, delivery date, seller, the product image URLs with the main one first, the options it comes in (such as color or size), and up to six key specs as label and value, the same specs for every candidate. For a comparison (see Comparing offers), also list the shipping cost, any membership perk the page shows, the return window and who pays return shipping (from the store's return policy page when the product page does not say), and the pack size. Most stores publish these facts as JSON-LD, so on a store with no site guide run this script in browser_run_code on each product page and read the rendered page only for what the script misses: `(() => { const o = [], a = (v) => [].concat(v ?? []), u = (i) => i?.url ?? i?.contentUrl ?? i, x = (n) => a(n.offers?.offers ?? n.offers).slice(0, 2), g = (n) => n.gtin ?? n.gtin13 ?? n.gtin12 ?? n.gtin14 ?? n.gtin8, w = (n) => { if (Object(n) !== n) return; if (Array.isArray(n)) return n.forEach(w); if (a(n['@type']).some((t) => /^(https?:\/\/schema\.org\/)?Product(Group)?$/.test(t))) { const b = a(n.brand)[0], k = a(n.variesBy).map((v) => String(v).split('/').pop()), v = a(n.hasVariant).slice(0, 20); return o.push({ name: n.name, url: n.url, brand: b?.name ?? b, model: n.model?.name ?? n.model, mpn: n.mpn, gtin: g(n), images: a(n.image).slice(0, 5).map(u), rating: n.aggregateRating, offers: x(n), ...(v.length > 0 && { variesBy: k, variants: v.map((e) => ({ name: e.name, url: e.url, image: u(a(e.image)[0]), options: Object.fromEntries(k.map((p) => [p, e[p]])), mpn: e.mpn, gtin: g(e), offers: x(e) })) }) }); } w(n['@graph']); w(n.mainEntity); w(a(n.itemListElement).map((e) => e?.item ?? e)); }; for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { w(JSON.parse(s.textContent)); } catch {} } return o.slice(0, 12); })()`. When a store blocks its product pages, take the facts from the search results instead, including each result's thumbnail image URL; the page text carries no image URLs, so read them from the result cards' images with browser_run_code. For a compare across stores, check two or three stores the user would buy from, and note each store that blocked you or had no match.
2. Fill the gaps before you present. A shortlist the user can choose from has a photo, a price, a rating, the stock state, and the specs that set the candidates apart for each product; a comparison also needs the extra facts step 1 lists for one. When you left out one of these for a candidate, look first in what you already read, then call fetch_url on the product pages still missing facts, all in parallel. Open in your browser only what fetch_url could not read, and leave out a fact no page showed. Many stores refuse fetch_url, even with a 404, while serving your browser, so a product page you opened and read in your browser in this task is a live link however fetch_url answered.
3. When the site wants a sign-in, a one-time code, or a verify-you-are-human check, follow the browser skill's Sign-ins and private details steps in their order, which end with the Secure Form (request_user_form) and then handing over your browser with request_browser_help and one instruction ("Sign in to your `<service>` account"). Never send clarifying_questions before these; the tool is the ask. After a receipt or a hand-back, take a fresh snapshot; the session persists across turns.
4. Compare. For a visual choice (looks, color, a spec table), take a browser_screenshot with show set. Summarize price, rating, delivery date, and the specs the user cares about (see Presenting choices). For a comparison, follow Comparing offers instead.
5. Get the pick. If the user delegated with exact criteria ("order whichever is cheaper delivered") and one product clearly wins, choose it, say why, and still show it before checkout. "Which should I get?" asks for your recommendation, not for you to choose, so the user still picks.
6. Check variants. Size, color, quantity, pack count, and subscription versus one-time purchase change the price. For the product the user is choosing, read each option combination its page offers, with that combination's price, stock, image URL, and page URL; on a store with no site guide, the script from step 1 returns them as a product group's variants. Ask with clarifying_questions when the user did not specify and the options are real; otherwise take the default and say so. A saved size (see Sizes and preferences) answers the size question only, so still ask about any other open variant. When more than one variant is open, ask about them together in one short message instead of one question at a time.
7. Add to cart. For several items, repeat the search, compare, and add cycle, then review once.
8. Review the cart from a browser_screenshot with show set, then send the user the cart summary: one line per item with the product as a link, its brand, the variant (size, color, pack count), quantity, unit price, and the seller when it is not the store itself, then the subtotal, shipping, tax, and total as far as the page shows them. When the cart changes, send a fresh summary so the latest one always matches the cart.
9. Shipping address. Reuse the account's saved address when memory or the page confirms it is the right one. If the page needs an address typed, call vault_fill_contact first, then request_user_form for what isn't saved, with fields targeted from your latest snapshot and the site's domain. Confirm the chosen address with the user before you continue.
10. Ask about a promo code before the final page if the checkout has a field for one and the user has not mentioned one.
11. Reach the final review page. Take a browser_screenshot. Check the subtotal, tax, shipping, and total against what you presented.
12. Pay (see Paying and confirming).
13. Take a browser_screenshot of the order confirmation with show set and report the order number, the total charged, and the delivery estimate. Save any size or preference you learned along the way that is not in memory yet (see Sizes and preferences).

## Sizes and preferences

The user should not have to repeat a size or a brand rule they already told you.

- Before you ask for a size, check the Memory section for their size in this brand, then their general size for this kind of item. Use what is saved and say which entry you used ("your usual Aritzia M"). Ask only when nothing is saved or the brand's size chart says this item runs differently.
- Brands size differently, so keep fit per brand and item type ("Levi's 501 jeans: 32x30", "Nike running shoes run small, size up half"), not one size for everything.
- When the user states a size, a fit note, a brand they like or avoid, a default retailer, or a material or ingredient rule, save it with update_memory, one fact per entry with the brand and item type. Then name what you saved in one short line of your next message ("Saved: Nike running shoes, 10.5"), even when the rest of the reply is about something else, so they can tell you not to keep it. If they do, remove it.
- A new size replaces the old one for that brand and item type, whether the user simply states it or says the last one did not fit (then wait until they confirm the new size). Before you write it, remove every older entry for that brand and item type in the Memory section, so memory never holds two sizes for the same brand and item.

## Presenting choices

- When show_products is among your tools and the products came from shop_search, show them with show_products instead of a text list: every shortlist, and a single product the user asked about or picked. In the text before it, give your pick and the main tradeoff.
- Otherwise, show three to five candidates that differ on something that matters, one per line as `- [Item name](https://item-page-url), $25.60, short note`. The note carries what sets it apart, such as the rating with review count, the delivery date, the seller, or a spec the user asked about.
- Attach a screenshot when the choice is visual or the spec table is dense. A summary alone is enough for a reorder.
- Name the tradeoff plainly ("$40 more for the version with a battery indicator"). Do not pad the list with near-duplicates.
- Use clarifying_questions for the pick when the shortlist is short and every option is a real product you saw. Otherwise send the summary and let the user reply.

## Comparing offers

When the user is choosing between two or three specific products, or the same product at different stores ("which of these two?", "is it cheaper at Target?"), put the offers side by side. Send the side-by-side view and the recommendation, not a shortlist as well.

- Every comparison covers the delivered price (item plus shipping and tax as far as the page shows), the delivery date, the membership perks that apply (Prime, Walmart+, a free shipping threshold), the return window and who pays return shipping, and the seller and its rating, even when the user said which specs matter most. Add the specs the user named after those.
- Read the return window from the product page or the store's return policy page. When neither shows it, write "not shown" rather than a typical value.
- For the same product at several stores, confirm the model number or pack size matches before comparing prices, and say when it does not.
- Use one column per offer in a compact table, or one line per offer on a channel that shows plain text.
- End with a one-line recommendation and the reason ("Target: $12 less delivered and a 90-day return window, arrives a day later"), then ask which one they want.

## Paying and confirming

- The user must have asked to buy this specific item. Never spend on your own initiative, and never buy to hold a price.
- Before payment, send one clarifying_questions card with the product, quantity, shipping address, delivery date, and the exact total from the review page. A dismissed question is a no.
- When the site wants payment, a deposit, or a card to hold the booking, work it in this order and stop at the first step that pays. First, a payment method already saved on the account: select it, and when several are saved, ask which one in the confirmation question. Next, send the Secure Form (request_user_form, the site's domain) for the card inputs the live checkout shows, such as card number, expiry, CVC, name, and billing ZIP; never tell them you can't take their card, and never predict that the form can't reach card inputs embedded from a payment provider. Last, when the form fails or its receipt says a card field failed, or the user would rather type on the page, hand your browser to the user with request_browser_help and one instruction ("Add your card and confirm the payment on `<service>`"); the same handoff covers a CVC re-entry and any 2FA, 3DS, or bank prompt. The user finishes the payment inside that handoff, so when the browser comes back, skip any later confirm or place-order click and read the confirmation page. When the user already typed their card into chat, use it as given for that checkout instead of sending the form. Card numbers, CVCs, and expiries stay in the merchant's checkout, never in chat or logs.
- Then take your browser to the place-order button and hand the confirm click to the user with request_browser_help and one instruction ("Place the order in your Amazon cart").
- If the total on the review page moved after the question, stop and show both numbers before anything is charged.

## Pitfalls

- Membership pricing and delivery promises differ from the guest view. Say which one the user is seeing.
- Out of stock, "ships in 3 to 5 weeks", or a delivery date after the user's deadline is a flag before checkout, not after.
- Bundle suggestions, protection plans, and subscribe-and-save upsells are ignored unless the user asked for them.
- Multi-page checkouts hide the real total until the last page. Screenshot the final review page, not the intermediate ones.
- A marketplace seller with poor ratings or a long ship time is worth a sentence even when the price is best.
- A page saying the site does not allow AI agents (Amazon shows one) ends that store for this request, so never reload or retry it. Do not stop at the block either. Take the product's brand and model number or UPC from what you already have, such as the user's link text, a search result, or the page's structured data, and check two or three other stores the user would buy from for that exact product. Match on the model number or UPC, not the title, and call out a near match as one. Then send one message: the blocked store and what its page said, in one line, then each store that has the product with its price, delivery date, and seller, presented as a compare (see Presenting choices), and your pick. When you ask for the store with clarifying_questions, its prompt opens with the blocked store and that it does not allow AI agents, because the options alone never tell the user why the store they named is missing.
- Never invent a price, a rating, a delivery date, or an order number. If the page did not show it, say so.

## Site guides

Before you open a store in your browser, load the `facebook_marketplace`, `ebay`, `etsy`, `craigslist`, `best_buy`, `target`, or `costco` skill, whichever names the site you are about to use, and follow the section that matches your step (a read-only lookup, or a cart and checkout). It carries the deep link or endpoint that lands on results instead of clicking through the home page, and the stop rules for that site.
