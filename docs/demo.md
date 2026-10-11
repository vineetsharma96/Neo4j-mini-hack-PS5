# Demo walkthrough

The core question is:

> Why did we change the authentication module, and could that change be related to the current API error?

## Explore the local sample

1. Start the app and select **Explore demo**. The Orbit API sample is clearly marked as synthetic and saved only in the browser.
2. In Graph, single-click a node to select it. Double-click it, press Enter or Space while it is focused, or use **Open selected record** to open details. Dragging moves nodes without opening the drawer. Node positions are not persisted across reloads.
3. Open the token-handling decision. Inspect its description, reason, alternatives, revisit conditions, and supporting evidence.
4. Open **Debug assistant**. Submit the prefilled question with **Trace the connection**.
5. Read the facts separately from the possible connection. Select evidence references to inspect the fictional excerpts and follow the highlighted graph connections.
6. Pause path animation if needed. On compact screens, dismiss the contextual drawer with its close button, Escape, or the backdrop.
7. Add a record in Memory, connect compatible records, and reload to check browser persistence. Destructive actions require confirmation. Settings → **Reset demo** restores the synthetic sample.

The local answer is scripted for the original scenario. Changing or removing its source records produces a limited local retrieval explanation instead. Reset the demo to restore the sample; local mode does not call Gemini.

## What the sample connects

The project has ten records and twelve domain connections:

- Authentication and API middleware components.
- A fictional token-library dependency.
- A decision to change authentication token handling and a reason describing the session requirements.
- A previous API 401 bug.
- A fix aligning token validation between authentication and middleware.
- Three fictional evidence records: session requirements, incident notes, and a verification checklist.

The decision affects Authentication; both components depend on the token library. The earlier bug affects middleware and involves that dependency. Its fix modifies the components, and evidence supports the decision, bug, and fix.

The verification note records a login check, with the refresh path still unverified. This supports a hypothesis that refreshed-token validation could be relevant to the current error. It does not establish the cause of a real failure.

The next concrete check is to reproduce a protected API request immediately after login and again after refresh, comparing issuer, audience, expiry, and validation settings without logging raw tokens. The current failing request and refreshed-token claims remain missing evidence.

## Run the authenticated version

Configure Firebase, Neo4j, and Gemini using [setup](setup.md). Sign in and select **Create sample project**. This creates a new synthetic project owned by the verified user in Neo4j; repeated seed actions create separate projects and preserve other data.

Ask the same question. The server checks ownership, retrieves connected records, sends the bounded context to Gemini, and validates its references. The interface labels the result as a Gemini explanation. Provider failures show an explicit error and retry action rather than switching to the local scripted answer.
