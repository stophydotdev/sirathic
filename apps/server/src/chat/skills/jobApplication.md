# Job application

Apply to job postings for the user, on the employer's form in your browser or by email. Finding the postings is the job_search skill's job. This skill turns a chosen posting into a sent application. Load the browser skill with this one.

When the user asks you to apply, that ask is their yes: fill the application and submit it without asking again. They may name the postings ("apply to this one", "apply to the first three") or leave the choice to you ("apply to the ones that fit me"). When they leave it to you, apply to every posting that meets all their stated requirements and say in one line why you skipped each of the others. When they only asked you to find postings, finish the search and offer to apply; do not submit anything.

## Entry points

- "Apply to this one" with a pasted link is an application, not a search. Open that exact URL.
- "Apply to the ones that fit" after a shortlist is an ask to apply to every posting on it that meets all their stated requirements.
- "Find me jobs and apply" is a search with job_search, then this skill for each posting that fits.

## Before you start

- Resume facts come from what the user told you, the CV they sent you, and memory: titles held, employers, dates, skills, education, links and contact details. Call search_user_memories for older facts that are not listed. Never invent a qualification, an employer, a date or a skill the user did not state.
- Before each application, check this chat for the posting: its URL, its job id, and the company with the title, in the earlier messages and with searchOurChat when you have it. Never apply twice to the same posting or to a repost of it. If you already applied, say when.

## Flow

1. Read the posting with the job endpoint for its site (see job_search) and find its apply route: LinkedIn Easy Apply, the applyUrl to the employer's own form (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday or the company's site), or an email address in the description.
2. A form: open the applyUrl, or the posting's Apply button for Easy Apply, in your browser and fill it with browser_task, giving it every value you hold. Put the CV the user sent you into the upload field with browser_upload. When the page asks for a name, phone or email, call vault_fill_contact first. Anything else you do not know goes to the user through request_user_form, with fields targeted at the live page. Salary expectations, work authorization and sponsorship, and demographic or self-identification questions go into that form as secret fields unless the user already told you the answer. The user chooses the answer to every optional demographic question; you never pick one. Multi-page applications get one form per page.
3. A free-text question, such as "Why do you want to work here?" or a cover letter field, gets a short answer in the user's voice built from their real experience and one stated requirement of this posting. No generic praise of the company.
4. When the site wants a sign-in, a one-time code, or a verify-you-are-human check, follow the browser skill's Sign-ins and private details steps in their order, which end with the Secure Form (request_user_form) and then handing over your browser with request_browser_help and one instruction ("Sign in to your `<service>` account"). Never send clarifying_questions before these; the tool is the ask. After a receipt or a hand-back, take a fresh snapshot; the session persists across turns. An external applicant tracking site that wants a new account is a sign-up the user does; hand it over with request_browser_help and one instruction.
5. An email: when the posting says to apply by email, load send_on_behalf and send the application with gmail_send_email to the address in the posting. Use the subject the posting asks for, or the job title and the user's name. Write a short note in the user's voice: the role, one concrete fit with a stated requirement, and links to their CV or profile. The email carries no file, so when the posting requires an attached CV and the user has none online, tell them and give them the address and the note to send themselves.
6. At the review step, read every answer on the page. If it shows an answer or a field you did not fill, or a resume you did not choose, fix it or ask about that one field. Then submit.
7. Report the confirmation number or the "application sent" message from the confirmation page, the posting title and company, the posting URL, and what the page says happens next. If no confirmation page appeared, say so; never call an application sent without one.

## Pitfalls

- Easy Apply sends the resume LinkedIn has on file. Read the file name and date shown on the review step and name them in your report. When the user sent you a newer CV, upload that one instead.
- External applicant tracking sites often want a new account with a new password. The account is the user's to create.
- LinkedIn rate-limits and throws checkpoint or verify-you-are-human walls after fast browsing. Slow down, work the sign-in order once, and do not retry a wall in a loop.
- A posting that closed or moved shows an error or a "no longer accepting applications" banner. Say so and move to the next posting.
- Never invent a posting, a salary, a deadline, or a company detail the page did not show. If the page did not show it, say so.
