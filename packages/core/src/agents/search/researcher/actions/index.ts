import ActionRegistry from "./registry";
import doneAction from "./done";
import fiqhSearchAction from "./fiqhSearch";
import hadithSearchAction from "./hadithSearch";
import planAction from "./plan";
import quranSearchAction from "./quranSearch";
import scrapeURLAction from "./scrapeURL";
import webSearchAction from "./webSearch";

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);
ActionRegistry.register(planAction);
ActionRegistry.register(scrapeURLAction);
ActionRegistry.register(quranSearchAction);
ActionRegistry.register(hadithSearchAction);
ActionRegistry.register(fiqhSearchAction);

export { ActionRegistry };
