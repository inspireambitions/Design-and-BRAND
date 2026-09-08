# Schools controlled tester guide

Prepared: 8 September 2026. Use only after the release owner confirms the final staging deployment and its checks.

This is a controlled adult test of the Schools product. Use fictional answers and the test cohort supplied by Kim. Do not enter real student records, employer information or sensitive personal stories. This invitation does not open a real institution pilot.

## Access

Kim supplies two separate items privately: access to the protected preview and your individual student or adviser invitation. The preview address is https://muqabala-schools-pilot-20260908-inspire14.vercel.app. The plain address may show a Vercel sign-in screen without the private access link.

Do not forward access links or recovery codes. Do not put them in screenshots, issue reports or group chats. Use separate browser profiles for student and adviser accounts. A cohort code alone cannot create an account.

Email users: follow the supplied sign-in instructions and use the same invited email address. Email-free test users: save the recovery code privately when it appears. It is shown once. If recovery fails, contact Kim for adviser-assisted recovery.

## Student checks

1. Open your invitation, complete enrolment and reach Your assignments. Record whether any step is unclear.
2. Open the assignment. Confirm it contains three questions and the draft privacy message.
3. Write a short fictional answer. Wait at least 12 seconds, move focus out of the answer and refresh. Confirm the saved text returns exactly.
4. Try I cannot think of an example. Confirm it offers prompts without writing your answer for you.
5. Answer all three questions and submit once. Confirm submission succeeds and your original text stays intact.
6. Read feedback. Check that every highlighted excerpt is in your answer. Report an interpretation you disagree with. Evidence covered describes the answer, not your abilities.
7. Retry the suggested question. Confirm the new attempt is separate and does not inherit the earlier adviser review.
8. Read the adviser comment and request support. Check the support status after the adviser responds.
9. Sign out. Use your approved recovery method and confirm you can return. In Account, test Sign out everywhere using two browser sessions.
10. At the end, ask Kim before testing deletion. Use only your disposable test account and confirm it no longer opens the old work.

For a network-loss check, use a fresh disposable attempt. Save the answer first, turn the connection off, try submission, restore the connection and retry. Confirm the text survives and only one submitted attempt appears. Record the exact steps. Do not repeatedly refresh while a normal submission is still running.

## Adviser checks

1. Open only the assigned test cohort. Confirm the cohort name, counts, due date and active assignment make sense.
2. Approve three questions and their rubric elements before assigning. Check that each element fits the question.
3. While the student is drafting, confirm you cannot see that draft. After submission, open the submitted attempt.
4. Check the attempt number, answer, supporting excerpts and confidence labels. Correct one element with a reason and check the revised evidence count.
5. Save an adviser view and a short comment. Within 10 seconds, use Undo and confirm the exact previous state and comment return.
6. After the student retries, confirm the new attempt is Not reviewed and the old review remains on the old attempt. Compare only when question and rubric versions match.
7. Open a support request, check ownership, update its status and confirm the student sees the change.
8. Tell Kim about unclear labels, missing context or any result that could mislead a student. Do not treat the tool as a hiring decision.

## Physical device and keyboard record

Run the student journey on a physical iPhone with Safari, a physical Android phone with Chrome and a desktop browser. Run the adviser journey on desktop and at least one physical phone. Record device model, OS version, browser version, date and deployment ID. Browser emulation is a separate check and must not be recorded as a physical-device pass.

Repeat enrolment, answering, submission and feedback with Tab, Shift+Tab, Enter and Space on desktop. Confirm focus remains visible, labels are clear, errors are announced or easy to find, and the page works at 200% zoom. On phones, check the on-screen keyboard, portrait and landscape layouts, backgrounding and returning to the browser, and network loss during a saved attempt.

## Messaging previews

The release owner must provide public marketing URLs that a crawler can reach. Do not use a private student invitation, recovery link or protected preview access token for this check. A blocked preview is not evidence that the product metadata failed.

For each of /, /schools and /for-employers, paste the approved URL into WhatsApp Web, iMessage and LinkedIn. Confirm title, description and image appear and describe the correct product. Record a screenshot with no personal chat details, the exact public URL, platform, date and deployment. Validate at least one platform debugger too. Do not send a message or publish a post just to test a preview without Kim's instruction.

Expected titles: Muqabala: private interview practice; Muqabala for Schools and Colleges; Muqabala for Hiring Teams. Images should show the Muqabala design, with no student names. Save sanitised evidence references in schools-build-log.md.

## Report an issue

Send Kim: your test role, device/browser, time and time zone, page path without its query string, steps, expected result, actual result and a sanitised screenshot. Include the displayed error text. Never include a password, cookie, email code, private link or recovery code.

Stop and report immediately if you see another person's work, lose saved text, cannot submit or receive a report for the wrong attempt. Keep other tests paused on that account until Kim confirms the next step.

## Release owner before invitations

Record the verified deployment ID, allocate individual accounts, confirm approved email delivery and sign-in, set a small test window and identify who watches errors. Start with five controlled testers. Review blocking issues, feedback latency and cost before increasing the group. Public student enrolment remains closed until the institution inputs and activation gates in schools-pilot-plan.md are complete.
