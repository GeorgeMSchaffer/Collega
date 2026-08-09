# Bug Triage

This document is the authoritative queue for bugs and minor tweaks that must be addressed before new feature work begins.

## Workflow

- Read this document before starting or resuming feature implementation.
- Items under `TODO` take priority over new features. Do not start a new feature while `TODO` contains unresolved items unless the user explicitly approves an exception.
- When an item is fixed and its focused validation passes, remove it from `TODO` and add it to `COMPLETED` with the completion date and a concise verification note.
- Do not duplicate an item between sections. If a change is incomplete, unverified, or deferred, keep it under `TODO` and note its status there.
- New bugs and minor tweaks belong under `TODO`; feature ideas remain in the delivery backlog.

## TODO
* Item form layout issues, label's such as Make or buy and quantity
* Session logout for user's is to fast 5 minutes or so
* Copy has been moved on the items form the data grid contextual menu

* Look into about displaying a message such as "The system is going to be update log out" or such as warning
 Current Materials form has issue with the bottom most textbox being cut off.

 * Customer's form throws an error on Open 12 times,


 * After the user changes their password they should be redirected to login.
 * The the text input boxes are not vertically centered, most likely due to excess padding
 * The look of the icons are outdated, let's use a new library such BlazorUI Icon, see https://demos.blazorbootstrap.com/icons

## COMPLETED

Move verified items here using this format:

- YYYY-MM-DD - Item summary. Verification: focused test, build, or manual check.