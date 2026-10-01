# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People preparing to buy their first home who need to understand a developer's floor plan, often while viewing sales material on a phone at a sales center.

## Product Purpose

Teach people to recognize symbols in Taiwanese residential floor plans and understand what to pay attention to. Success means a reader can identify a symbol on a plan and judge the basis for its explanation.

## Positioning

An interactive floor-plan guide that connects symbols on a plan to plain-language explanations, source documents, and recognition practice. It makes the basis and strength of each explanation visible so readers can judge it themselves.

## Operating Context

Readers may arrive from search directly at a symbol page, browse symbols by category, explore a sample layout, or practice recognition with the "Find it" quiz. The site is used on phones as well as desktop browsers; the most demanding setting is a sales center with bright light and one-handed phone use.

## Capabilities and Constraints

- The existing product is built with Next.js and TypeScript and publishes as a static site.
- Readers can search and browse symbols, open symbol explanations and their source references, explore interactive sample floor plans, and play a recognition quiz.
- Floor-plan layouts, rendered floor-plan data, hotspots, symbol records, and source references are maintained as project data. Explanations must reflect those records; do not invent symbols, sources, or verification claims.
- The site is in Traditional Chinese. Product terms and distinctions are defined in `CONTEXT.md`.
- Preserve the established interaction behavior and the distinction between source tier, source references, and verification status.

## Brand Commitments

The product is named 平面圖教學網站. Its voice explains floor-plan concepts for people who are new to reading plans and makes evidence inspectable rather than asking readers to accept an unsupported answer.

## Evidence on Hand

- Sample residential floor-plan data and hotspot records in `data/layouts/`.
- Symbol records, symbol artwork, and source references in `data/`.
- Product requirements in `平面圖教學網站-PRD-Phase1.md`.
- Domain terminology and established design constraints in `CONTEXT.md` and `DESIGN.md`.
- Do not fabricate endorsements, customer research, or verification evidence beyond the records in the project.

## Product Principles

- Teach recognition in the context of a complete floor plan.
- Explain symbols in plain language for first-time home buyers.
- Make the documents behind an explanation available for readers to inspect.
- Keep practice supportive and focused on learning, without shaming mistakes.
- Preserve the meaning and provenance of project data across every surface.

## Accessibility & Inclusion

Support keyboard interaction, visible focus, screen readers, and reduced-motion preferences. Maintain WCAG AA contrast for text and required non-text indicators, including interactive states on floor plans.
