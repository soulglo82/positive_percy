# Positive Percy — Privacy Policy

**STATUS: DRAFT — NOT AUTHORISED FOR PUBLICATION**
**Last reviewed against implementation:** 12 November 2026

> Release block: identify the legal controller and operating country, a real monitored privacy contact, actual lawful bases, processor/subprocessor list, international transfer arrangements, log retention periods, R2 backup retention and an effective date. Independent legal/privacy review required before replacing this banner.

## In brief

Positive Percy is a family rewards app operated by adults. A parent or carer creates a family and adds children to recognise positive behaviours, award points, track progress and manage rewards. The app does not require children to register their own account.

The family code is an **access credential**, not an ordinary invite identifier: someone who has it can access and modify the family's information. Parents should share it only with trusted adults and protect it as they would a password. A more granular adult-access model is planned but not yet available.

## Who is responsible for your data?

**[Controller's full legal name, registered location and contact address to be supplied before publishing.]**

Privacy questions or requests: **[Monitored privacy email/contact route to be supplied.]**

## What information we process

Adults choose the family name, family timezone, behaviour categories, weekly targets, parent names and optional phone details. They may add children's names and ages, photos, achievements, point awards and correction notes, redemption records, rewards, and family goals. Children need not provide a date of birth. The application also maintains session tokens and essential operational records such as database migrations and request retry keys.

Information written into a description or note may be personal or sensitive. Adults should avoid entering medical, disciplinary or other sensitive information about a child unless strictly necessary — it is not required to use Percy.

## Why we use it

The information supports creation and operation of the family account, accurate points and rewards, synchronisation across connected devices, correction history, family reports, data export, security and necessary maintenance.

**[Legal bases for adults and children's data, including any consent requirements, must be confirmed against the actual offering, jurisdiction and contracts.]**

## Who can see it

Anyone with the family's access code can join and access that family's data; there are currently no separately permissioned adult accounts. The app does not intentionally offer public family profiles or a public social feed. Uploaded images are currently retrievable by unguessable image URLs and do not require a bearer token. Do not share image links publicly.

**[Processor inventory to confirm]** The live deployment uses Railway for hosting/database, Cloudflare R2 for backup storage and GitHub for source code and release tooling. The operational inventory must confirm service regions, logging, analytics, support tooling, and any image providers, including legacy external image URLs. Other processors must be added before publication.

## Where data is stored or transferred

The application's current Railway services are deployed in Singapore. This does **not** demonstrate that every connected service, backup, support log or processing location stays in Singapore. **[Document actual locations and safeguards for international transfers before publication.]**

## Retention and deletion

Adults can download a copy of the family's data. The technical JSON export contains retained account records and eligible uploaded photos; the PDF Family Report is a shorter readable snapshot.

A seven-day recoverable account-deletion feature is being developed. **It is not currently available**; this policy must be revised when enabled, particularly to explain what occurs during the recovery window and when live data are actually erased.

**[Verify actual retention for active accounts, expired accounts, uploads, access logs, and database backups. Verify backup objects are held beyond use after valid erasure, plus tested restoration procedures.]**

## Security

Protected endpoints require a signed session token and are scoped to the family. Parents are responsible for protecting the family code, device and downloaded files. A PDF or JSON download contains private information, and should be stored and shared carefully. No security control guarantees absolute protection.

## Your choices and rights

Adults can correct points, edit or remove family profiles and rewards, or download family data through Settings. Applicable privacy law may also grant rights to request access, correction, erasure, restriction, objection or portability, subject to exceptions.

**[Provide a live request process, response timeline, supervisory authority contact and law-specific rights depending on controller location and affected families.]**

## Children's simple explanation

Percy helps your grown-ups remember the good things you do. They can write your name, age, points, rewards and achievements here, and may add a photo. They can choose what to record and can ask to remove it. You don't need to tell Percy private things about yourself. If you're unsure about something, ask your grown-up.

## Policy changes

We will update the date and make important privacy changes clear in the app. **[Process and advance notice terms to confirm.]**

## References for the reviewer

- UK ICO Children's code: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/
- UK ICO right to erasure and backups: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
- UK ICO design guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/designing-products-that-protect-privacy/childrens-code-design-guidance/

**Do not publish this policy until the bracketed items and legal review are completed.**
