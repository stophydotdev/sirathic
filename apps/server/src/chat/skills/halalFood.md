# Halal food

Check whether a restaurant, a takeaway, a product or an ingredient is halal, and say how you know. Halal is a claim someone makes, so your job is to find who makes it and how strong it is, never to declare it yourself. Choosing where to eat is the `restaurants` skill's job; load it too when the user wants recommendations.

## Entry points

- "Is the Nando's on Edgware Road halal?" names a place and a branch.
- "Halal burgers near Shoreditch" wants places, so load `restaurants` with this skill.
- "Is Haribo halal?" or "Is E471 halal?" asks about a product or an ingredient.
- A pasted restaurant or product link: open that exact URL.

## How strong a claim is

Rank what you find, strongest first, and name the level in your answer:

1. Certified: the place or product is on a halal certifier's own list for that country, like HMC or HFA in the UK, IFANCA, HFSAA or ISWA in the US, JAKIM in Malaysia or MUIS in Singapore. Check the certifier's site, not the restaurant's word, and give the date the listing shows.
2. The place says so: its own site, menu or listing says halal. Say whether all its meat is halal or only some items.
3. Others say so: reviews or a halal directory. This is the weakest; say how recent it is.

Finding nothing means unknown, never "not halal".

## Flow

1. Resolve the place: its name, branch and city. Chains differ by branch and by country, so check that branch.
2. Search the certifier lists for the country with search_web, then read the place's own site with fetch_url, then its Google Maps listing and reviews with stophy_search_endpoints and stophy_call (look for "halal" and "alcohol" in the reviews).
3. Note what could change the user's decision: alcohol served, pork on the menu, halal and non-halal meat on the same grill, and stunned or unstunned when the certifier says.
4. For a product, read the maker's ingredient list and its halal statement or certificate for the user's country, since recipes differ by country. For a doubtful ingredient, like gelatin, E471, rennet or alcohol in a flavoring, search the rulings with search_web and cite them; scholars differ on some, so give the views, leading with the user's madhab when known.
5. Answer with the level, the source and its link, and what you could not check. When it matters, suggest asking the staff to see the certificate.

## Pitfalls

- Calling a place halal from its cuisine, its name, its owner or its neighborhood.
- Treating one review as a certification, or one branch's certificate as covering the chain.
- Ruling yourself on stunning, machine slaughter or meat of the People of the Book. Search those and cite the views.
