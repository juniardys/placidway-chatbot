# PRD — PlacidWay Website Knowledge Chatbot

## Problem Statement

PlacidWay visitors need fast answers about treatments, clinics, packages, destinations, and prices. Relevant information exists across a limited set of PlacidWay pages, but visitors must find and interpret it themselves.

The assessment requires a chatbot that answers only from the supplied PlacidWay content, cites the page used, preserves pricing context, and honestly declines questions that cannot be answered from the knowledge base. The chatbot must be publicly accessible for evaluation and simple enough to explain and modify during a review call.

## Solution

Build a public Next.js chatbot backed by a controlled retrieval-augmented generation pipeline.

A background ingestion process fetches only the seven approved source URLs, respects robots.txt and approximately one request per second, cleans and normalizes page content into Markdown with source metadata, chunks the content, creates embeddings, and stores searchable documents and vectors in Supabase Postgres with pgvector.

The chat API retrieves relevant evidence, applies grounding and safety rules, and generates an answer only from retrieved evidence. Every factual answer includes source URL citations. If evidence is missing or insufficient, the chatbot says it does not know and suggests contacting PlacidWay for a free quote. A simple web UI provides the chat experience. A secured refresh operation updates the knowledge base without discarding the last successful snapshot when refresh fails.

## User Stories

1. As a website visitor, I want to ask questions in natural language, so that I can understand PlacidWay treatment information quickly.
2. As a website visitor, I want answers based only on approved PlacidWay pages, so that I am not given unsupported information.
3. As a website visitor, I want each factual answer to include its source page, so that I can verify the information.
4. As a website visitor, I want to know when the chatbot cannot answer, so that I do not mistake uncertainty for fact.
5. As a website visitor, I want an unknown answer to suggest contacting PlacidWay for a free quote, so that I have a next step.
6. As a website visitor, I want treatment prices to include currency, so that the amount is meaningful.
7. As a website visitor, I want price qualifiers such as starting-from language and package inclusions preserved, so that pricing is not misleading.
8. As a website visitor, I want the chatbot to compare countries only when both relevant facts exist in the knowledge base, so that comparisons are evidence-based.
9. As a website visitor, I want treatment package contents summarized, so that I can understand what is included.
10. As a website visitor, I want follow-up questions to use conversation context, so that I do not need to repeat the treatment or country.
11. As a website visitor, I want the chatbot to decline appointment-booking requests it cannot perform, so that I am not promised an unavailable service.
12. As a website visitor, I want out-of-scope questions declined politely, so that the chatbot stays focused on PlacidWay content.
13. As a website visitor, I want medical-advice questions handled cautiously, so that the chatbot does not diagnose or claim that a treatment is safe for me.
14. As a website visitor, I want a short medical disclaimer when relevant, so that informational content is not mistaken for medical advice.
15. As a website visitor, I want the chatbot to reject unsupported premises such as an unverified price, so that it does not confirm misinformation.
16. As a visitor using another language, I want answers in my language when feasible, so that the information is accessible.
17. As a content operator, I want ingestion restricted to the seven approved URLs, so that the bot does not crawl beyond the assessment scope.
18. As a content operator, I want the crawler to identify itself with a clear User-Agent, so that source sites can identify the traffic.
19. As a content operator, I want ingestion to respect robots.txt and request pacing, so that source sites are not abused.
20. As a content operator, I want raw source snapshots retained, so that ingestion and answer provenance can be audited.
21. As a content operator, I want normalized Markdown documents, so that content is readable, reviewable, and suitable for chunking.
22. As a content operator, I want source metadata attached to every indexed chunk, so that citations can be generated reliably.
23. As a content operator, I want refresh to detect unchanged pages, so that unnecessary embedding work is avoided.
24. As a content operator, I want a failed refresh to preserve the last successful knowledge base, so that the public chatbot remains usable.
25. As a content operator, I want to trigger a secured refresh, so that content can be updated when source pages change.
26. As a product owner, I want unanswered questions logged, so that content gaps can be identified.
27. As a product owner, I want a public URL, so that evaluators can test the chatbot without installing software.
28. As an evaluator, I want setup and architecture documented, so that I can understand and assess the implementation.
29. As an evaluator, I want the eight required test questions answered and recorded, so that the chatbot behavior is demonstrable.
30. As a developer, I want ingestion, retrieval, grounding, and answer policy separated, so that each behavior can be tested and changed independently.
31. As a developer, I want secrets kept outside source code, so that deployment credentials and model keys are not exposed.
32. As a reviewer, I want the implementation to be understandable in a 45-minute walkthrough, so that design decisions can be explained and modified live.

## Implementation Decisions

- Use Next.js for the public chat UI, server-side API routes, admin refresh operation, and deployment.
- Use LangChain JS for document loading, text processing, embeddings integration, retrieval orchestration, and model integration where useful.
- Use Supabase Postgres with pgvector as the persistent knowledge base and vector search layer.
- Store source records, normalized documents, chunks, embeddings, content hashes, fetch timestamps, ingestion status, and source metadata in Supabase.
- Use exactly seven whitelisted source URLs supplied by the assessment. The ingestion process must reject URLs outside this allowlist.
- Fetch source content in a background or operator-triggered ingestion process, not through a user-facing live web-scraping agent tool.
- Identify the crawler with a clear User-Agent, respect robots.txt, and pace requests at approximately one request per second.
- Preserve raw fetched content and create normalized Markdown documents with frontmatter or equivalent metadata.
- Attach source URL, source ID, title, page type, section, fetch timestamp, and content hash to every chunk and retrieval result.
- Chunk content by semantic sections and headings where possible. Preserve pricing, package inclusion, procedure, recovery, clinic, and disclaimer sections as coherent units.
- Re-index only changed documents based on content hashes. Keep the last successful active snapshot when a refresh fails.
- Expose a secured refresh operation for updating the knowledge base. Scheduled refresh is optional; the initial implementation must support an operator-triggered refresh.
- Use a deterministic retrieval-and-answer flow rather than an autonomous browsing agent: retrieve evidence, validate evidence, apply answer policy, then generate a response.
- Require retrieved evidence before returning factual claims. If evidence is missing or below the configured relevance threshold, return an explicit unknown response.
- Generate citations from stored metadata and source URLs, not from URLs invented by the language model.
- Preserve source wording and qualifiers for prices, including currency, starting-from language, package context, and whether a price is absent.
- Add explicit handling for out-of-scope questions, appointment requests, unsupported price premises, and medical-advice requests.
- Keep chat history available for follow-up retrieval, while ensuring history cannot override source evidence.
- Log unanswered or low-confidence questions without storing unnecessary personal data.
- Keep API keys, Supabase credentials, refresh secrets, and deployment secrets in environment variables.
- Provide a simple chat UI with question input, answer rendering, citation links, loading state, error state, and conversation history.
- Provide README documentation covering setup, architecture, ingestion, retrieval, environment variables, deployment, refresh, limitations, and model/provider choices.
- Record answers for all eight assessment test categories: cost, comparison, package contents, follow-up, unavailable appointment, out-of-scope question, medical advice, and trick question.

## Testing Decisions

Tests must verify externally observable behavior at the highest available seam. Tests should not assert internal LangChain calls, vector-store implementation details, or exact prompt wording.

- Test the chat API boundary with representative questions and assert answer content policy, citations, fallback behavior, and safety behavior.
- Test the ingestion boundary with approved and disallowed URLs. Assert allowlist enforcement, normalized content, metadata, pacing-related request behavior, and failure handling.
- Test the retrieval boundary with seeded documents. Assert that relevant chunks and source metadata are returned for cost, package, clinic, and comparison queries.
- Test price behavior with currency, starting-from qualifiers, package context, missing prices, and contradictory user premises.
- Test unknown behavior with questions whose answer is absent from all seven sources. Assert explicit uncertainty and the PlacidWay quote suggestion.
- Test source citation behavior. Assert every factual response includes citations derived from indexed source metadata.
- Test medical safety behavior with diagnosis and treatment-safety questions. Assert no diagnosis, individualized safety claim, or unsupported medical recommendation.
- Test follow-up behavior using a multi-turn conversation. Assert that context helps retrieval without introducing facts absent from the knowledge base.
- Test refresh behavior for unchanged content, changed content, partial fetch failure, and total refresh failure. Assert that the previous active snapshot remains available after failure.
- Test the public UI end-to-end for submitting a question, displaying an answer, opening a citation, showing loading state, and showing an error state.
- Run the eight assessment questions as a repeatable acceptance suite and retain the resulting answers for submission.
- Add regression cases for every discovered hallucination, missing citation, incorrect price qualifier, or unsafe medical response.

## Out of Scope

- Crawling links beyond the seven approved source URLs.
- General web search or live browsing while answering visitor questions.
- Booking appointments, collecting payments, or guaranteeing treatment availability.
- Personalized diagnosis, medical risk assessment, or treatment recommendations.
- Verifying whether source-page medical claims are clinically correct.
- Building a full CMS for PlacidWay content.
- Automatic human approval workflows for every content refresh.
- Native mobile applications.
- Complex analytics dashboards.
- Multi-tenant knowledge bases.
- Production-grade lead-management or CRM integration in the initial version.
- n8n as the core chatbot or retrieval layer. n8n may be added later for optional automation such as scheduling, notifications, or lead workflows.
- Guaranteeing multilingual quality beyond the selected model's capabilities.
- Guaranteeing live answers when all source fetches and the deployed service are unavailable.

## Further Notes

The assessment prioritizes accuracy and honesty over visual polish. A smaller deterministic RAG system is preferred over an autonomous agent that can browse freely or invent citations.

The active knowledge base should expose freshness information for operators, including last successful refresh and stale status. A stale but valid snapshot is preferable to an empty knowledge base after a failed refresh.

Potential future improvements include better source-aware reranking, a human review queue for content changes, richer unanswered-question analytics, lead capture with explicit consent, and an evaluation set built from real visitor questions.
