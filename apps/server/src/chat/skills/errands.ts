import { BROWSER_TOOLS } from "../../bots/browser";
import { STOPHY_TOOLS } from "../stophyTools";
import type { Skill } from "./builtIn";
import foodOrdering from "./foodOrdering.md" with { type: "text" };
import groceryShopping from "./groceryShopping.md" with { type: "text" };
import ordersAndReturns from "./ordersAndReturns.md" with { type: "text" };
import purchases from "./purchases.md" with { type: "text" };
import rideshare from "./rideshare.md" with { type: "text" };
import shopping from "./shopping.md" with { type: "text" };
import bestBuy from "./sites/bestBuy.md" with { type: "text" };
import costco from "./sites/costco.md" with { type: "text" };
import craigslist from "./sites/craigslist.md" with { type: "text" };
import doorDash from "./sites/doorDash.md" with { type: "text" };
import ebay from "./sites/ebay.md" with { type: "text" };
import etsy from "./sites/etsy.md" with { type: "text" };
import facebookMarketplace from "./sites/facebookMarketplace.md" with { type: "text" };
import fedex from "./sites/fedex.md" with { type: "text" };
import instacart from "./sites/instacart.md" with { type: "text" };
import luma from "./sites/luma.md" with { type: "text" };
import realtor from "./sites/realtor.md" with { type: "text" };
import target from "./sites/target.md" with { type: "text" };
import ups from "./sites/ups.md" with { type: "text" };
import usps from "./sites/usps.md" with { type: "text" };

const SITE_GUIDES = [
  {
    name: "best_buy",
    when: "Best Buy: search by name, or price, stock or pickup for a SKU",
    text: bestBuy,
  },
  {
    name: "costco",
    when: "Costco: costco.com product price and availability, or a Same-Day cart",
    text: costco,
  },
  {
    name: "craigslist",
    when: "Craigslist: search listings near a city, not posting or replying",
    text: craigslist,
    tools: [...STOPHY_TOOLS, ...BROWSER_TOOLS],
  },
  {
    name: "doordash",
    when: "DoorDash: find stores, a menu, a cart, or a checkout read-back",
    text: doorDash,
  },
  {
    name: "ebay",
    when: "eBay: find, price, or check a product listing",
    text: ebay,
    tools: [...STOPHY_TOOLS, ...BROWSER_TOOLS],
  },
  {
    name: "etsy",
    when: "Etsy: find or price a product, not seller tools or shop apps",
    text: etsy,
  },
  {
    name: "facebook_marketplace",
    when: "Facebook Marketplace: used items, cars, or rentals for sale near you",
    text: facebookMarketplace,
  },
  {
    name: "fedex",
    when: "FedEx: track a package, not label creation, proof of delivery or refunds",
    text: fedex,
  },
  {
    name: "instacart",
    when: "Instacart: search and add groceries to a cart, guest first",
    text: instacart,
  },
  {
    name: "luma",
    when: "Luma: find events or read one event page, not host tools",
    text: luma,
    tools: [...STOPHY_TOOLS, ...BROWSER_TOOLS],
  },
  {
    name: "realtor",
    when: "Realtor.com: home listings or school ratings",
    text: realtor,
    tools: [...STOPHY_TOOLS, ...BROWSER_TOOLS],
  },
  {
    name: "target",
    when: "Target: find or price a product, or check store pickup for a TCIN",
    text: target,
  },
  { name: "ups", when: "UPS: track a package", text: ups },
  {
    name: "usps",
    when: "USPS: tracking, not pickup, hold mail, Informed Delivery or address change",
    text: usps,
  },
];

export const errandSkills: Skill[] = [
  {
    name: "purchases",
    when: "Load whenever you deal with credit cards, including a user who sends, offers, or asks you to remember one before any checkout, and when the user asks you to buy, book, order, or pay for something, before you start shopping or booking, not only at checkout",
    text: purchases,
    tools: BROWSER_TOOLS,
  },
  {
    name: "shopping",
    when: "Load when the user asks you to buy, order, reorder, or compare a product on Amazon or any other retail site, asks which of two or three products to get or whether one costs less at another store, or sends a product link to purchase, before you open the store or add anything to a cart, alongside any store's site guide. Load it as well as the `purchases` skill, which covers only how to pay",
    text: shopping,
    tools: [...STOPHY_TOOLS, ...BROWSER_TOOLS],
  },
  {
    name: "grocery_shopping",
    when: "Load when the user asks you to buy groceries or household staples, do or repeat a weekly grocery order, turn a recipe or meal plan into a shopping list, or order from Instacart, Costco Same-Day, or another grocery delivery site, before you open the store or add anything to a cart",
    text: groceryShopping,
    tools: BROWSER_TOOLS,
  },
  {
    name: "food_ordering",
    when: "Load when the user asks you to order food for delivery or pickup, reorder a usual meal, get a specific dish brought to them, or says they are hungry and wants you to handle dinner, before you open a delivery app",
    text: foodOrdering,
    tools: BROWSER_TOOLS,
  },
  {
    name: "orders_and_returns",
    when: "Load when the user asks where an order or package is, wants to return, exchange, or cancel something they bought, reports a missing, late, or damaged order, or wants to hear when a product's price drops or it is back in stock, before you open the store or carrier site",
    text: ordersAndReturns,
    tools: BROWSER_TOOLS,
  },
  {
    name: "rideshare",
    when: "Load when the user asks you to get them a ride, call a car, or book an Uber, Lyft, Bolt, Grab, or another rideshare for now or for a set time, before you open the service or request anything",
    text: rideshare,
    tools: BROWSER_TOOLS,
  },
  ...SITE_GUIDES.map(({ name, when, text, tools }) => ({
    name,
    when: `Site guide for ${when}. Load before you open it in your browser`,
    text,
    tools: tools ?? BROWSER_TOOLS,
  })),
];
