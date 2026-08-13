# Qualification Proof

Prove your qualification. Keep your certificate private.

## What Is the Product?

### The problem

Today, proving a professional or educational qualification usually requires revealing the qualification itself.

A person applying for a job, joining a course, entering a professional community, accessing a benefit, or attending an exclusive event may be asked to submit a certificate, diploma, badge, or other credential.

This creates an unnecessary privacy problem.

A certificate may contain much more information than the verifier actually needs:

- the holder's full name
- certificate number
- date of birth
- institution or organization
- course details
- grades or scores
- photograph
- signature
- certificate metadata
- other personally identifying information

In many situations, the verifier only needs to know one thing:

> **Does this person possess a valid qualification issued by a recognized issuer?**

Qualification Proof allows the holder to answer that question **without handing over the underlying certificate**.

### The product

Qualification Proof is a privacy-preserving credential verification platform built on Midnight.

A trusted organization — such as a university, professional body, training provider, certification authority, or employer — can issue a digital qualification credential to a recipient.

The recipient retains the credential privately.

When the recipient needs to prove a qualification, they generate a zero-knowledge proof demonstrating that their private credential satisfies the verifier's requirements.

The verifier receives the proof rather than the certificate.

### Example

Alice is applying for a position requiring a Certified Midnight Builder qualification. Instead of uploading her certificate, Alice generates a proof:

> **“I possess a valid Certified Midnight Builder credential issued by an approved issuer.”**

The verifier can verify the proof without learning Alice's certificate contents.

The system therefore separates:

**possessing a qualification** from **revealing the qualification document**.

## Who Uses It?

Qualification Proof has three primary participants.

### Credential Issuers

Organizations that issue qualifications.

Examples include:

- universities
- professional certification bodies
- training providers
- bootcamps
- employers
- conference organizers
- membership organizations

Issuers create structured credentials, cryptographically sign them, and register the information necessary for subsequent verification.

### Credential Holders

People who have received qualifications.

The holder keeps their credential and associated private information under their control.

They can generate proofs whenever they need to demonstrate a qualification.

### Credential Verifiers

Organizations or individuals who need to establish that somebody possesses a qualification.

Examples include:

- employers
- recruiters
- universities
- course providers
- event organizers
- professional organizations
- gated communities
- grant or benefit providers

The verifier does not need access to the holder's underlying certificate.

## Why Midnight Specifically?

Qualification Proof is fundamentally a **privacy problem**, not merely a credential-storage problem.

A transparent blockchain is excellent at proving that publicly visible state exists and has not been tampered with.

It is much less suitable when the fact being verified depends on private information.

Consider the statement:

> “This person possesses a valid qualification issued by Organization X.”

The underlying evidence could contain the person's name, certificate identifier, date, course information, or other sensitive information.

On a transparent chain, making that evidence directly verifiable often means making some representation of that information observable.

Midnight allows the application to express the verification rules as zero-knowledge circuits.

The holder can prove that:

- they possess a valid credential
- the credential was issued by an authorized issuer
- the credential has not been revoked
- the credential satisfies a required qualification
- particular conditions are satisfied

without necessarily revealing the private inputs used to establish those facts.

This is precisely the type of application for which Midnight's programmable privacy and selective disclosure model is designed. Midnight describes programmable privacy as allowing developers to determine what information should be protected and what information should be disclosed.

### Why not a transparent chain?

A transparent chain could store:

```text
credentialId
issuer
holder
qualification
issuedAt
expiry
status
```

But this makes the credential ecosystem itself observable.

Qualification Proof instead aims for:

```text
Public:
    issuer registry
    issuer authorization
    credential commitment / public reference
    revocation state
    verification rules

Private:
    credential contents
    holder identity
    certificate metadata
    private credential secret
```

The proof establishes the relationship between the two without publishing the private information.

That is the central Midnight value proposition.

## Data Model

The system deliberately separates **public verification state** from **private credential data**.

| Data Point                      | Location / Type                 | Disclosure                  |
| ------------------------------- | ------------------------------- | --------------------------- |
| Issuer identifier               | Public ledger                   | Everyone                    |
| Issuer authorization/status     | Public ledger                   | Everyone                    |
| Credential commitment/reference | Public ledger                   | Everyone                    |
| Credential revocation/status    | Public ledger                   | Everyone                    |
| Qualification type              | Public or selectively disclosed | Depends on proof            |
| Credential contents             | Private state                   | Holder only                 |
| Holder identity                 | Private credential/witness      | Holder only                 |
| Certificate metadata            | Private credential/witness      | Holder only                 |
| Credential secret               | Private witness                 | Never disclosed             |
| ZK proof                        | Verification artifact           | Verifier                    |
| Verification result             | Publicly verifiable result      | Verifier / parties involved |

The precise Compact ledger and witness representation will be finalized during implementation, but the architectural principle is fixed:

> **The ledger stores what needs to be trusted and verified; the holder retains what needs to remain private.**

## Mainnet Feasibility

Qualification Proof is intentionally designed to be achievable as a production-oriented MVP rather than an attempt to build an entire global credential infrastructure before launch.

The project can therefore target by Level 6:

- finalize product architecture
- finalize credential and issuer data models
- implement core Compact contracts
- implement proof generation
- implement verification flow
- complete end-to-end issuer → holder → verifier workflow
- integrate Midnight Wallet
- deploy to Midnight Preprod
- conduct security and privacy testing
- polish UX
- conduct real-user testing

So, by Level 6, the project targets a production-ready release suitable for Midnight Mainnet deployment, subject to the project's security review, network requirements, and Mainnet deployment readiness process.

The scope is deliberately constrained:

> **One credential type. One issuer workflow. One proof workflow. One verifier workflow.**

The architecture is extensible, but the MVP is not.

That makes it realistic for the project to reach Mainnet by Level 6 without sacrificing the underlying product vision.
