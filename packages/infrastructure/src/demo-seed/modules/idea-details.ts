/**
 * Problem, Proposed solutions and Impact rationale for every seeded idea
 * (SPEC/20-feature-ideas-and-engagement.md rule 2a: "The demo seed writes real values for all
 * three"). Keyed by the board's `focus`, one entry per `IDEA_SCENARIOS` item in the same order, so
 * each board's eleven ideas read as that board's own work rather than one text with the name
 * swapped in.
 */
export type DemoIdeaDetails = {
  readonly problem: string
  readonly proposedSolutions: readonly string[]
  readonly impactRationale: string
}

export const IDEA_DETAILS_BY_FOCUS: Readonly<Record<string, readonly DemoIdeaDetails[]>> = {
  'Assembly cell reliability': [
    {
      problem:
        'When a cell faults on second shift, the operator radios the line lead, who pages maintenance, who then calls controls engineering. Each handoff is verbal, so the fault code is re-read three times and often lost.',
      proposedSolutions: [
        'Have the cell controller open a maintenance ticket with the fault code and last 60 seconds of I/O attached.',
      ],
      impactRationale:
        'Cell stoppages average 42 minutes, and roughly 15 of those are spent relaying the fault. Cutting that in half across 30 cells returns about 110 production hours a month.',
    },
    {
      problem:
        'Gripper vacuum pressure drifts for hours before a part is dropped, but nobody sees the trend until the cell stops with a jam.',
      proposedSolutions: [
        'Alert the line lead when vacuum pressure falls 10% below its rolling baseline.',
        'Show the drift on the cell HMI next to the cycle counter.',
      ],
      impactRationale:
        'Dropped-part jams caused 23 unplanned stops last quarter at about 35 minutes each. Catching half of them early saves roughly 7 hours of downtime a quarter per line.',
    },
    {
      problem:
        'Changeover requests arrive by email and hallway conversation, often without the fixture number or the torque program, so the setup tech has to chase details before starting.',
      proposedSolutions: [
        'Replace ad hoc requests with a one-page changeover checklist in the MES.',
        'Block scheduling of a changeover until fixture, program and material are filled in.',
        'Print the checklist on the traveller so the tech has it at the cell.',
      ],
      impactRationale:
        'Setup techs report 20 to 30 minutes of chasing per changeover. At 12 changeovers a week that is up to 6 hours of cell time recovered weekly.',
    },
    {
      problem:
        'Every PLC parameter change, even a timer tweak, waits for the weekly change board, so small fixes that would stop a recurring fault sit for days.',
      proposedSolutions: [
        'Pilot a same-day review by one controls engineer for low-risk parameter changes, with automatic rollback if the cell faults within an hour.',
      ],
      impactRationale:
        "Nine of last month's 14 changes were timer or offset tweaks. Shipping them the same day would have avoided an estimated 40 repeat faults.",
    },
    {
      problem:
        'The same light-curtain trip happens several times a shift on cell 7, but each one is cleared and forgotten, so no one owns the root cause.',
      proposedSolutions: [
        'Rank fault codes by recurrence per cell on a shift-start dashboard.',
        'Assign an owner automatically when a code repeats three times in a shift.',
      ],
      impactRationale:
        'Repeat faults make up about 60% of all stops. Giving the top five an owner is the cheapest route to fewer stoppages and fewer safety resets.',
    },
    {
      problem:
        'The weekly OEE report is assembled by hand from three spreadsheets and takes the quality engineer most of Monday morning. It is often late and occasionally wrong.',
      proposedSolutions: [
        'Generate the weekly OEE summary directly from MES counts and downtime codes every Monday at 6:00.',
      ],
      impactRationale:
        'Frees about 4 engineering hours a week and gives supervisors a report they trust before the Monday production meeting.',
    },
    {
      problem:
        'Recovery after an e-stop depends on who is on shift. Experienced operators re-home the robot safely, newer ones sometimes restart mid-cycle and damage fixtures.',
      proposedSolutions: [
        'Write one recovery playbook per cell type with photos of the home position.',
        'Link the playbook from the HMI fault screen.',
      ],
      impactRationale:
        'Two fixtures were damaged during recovery this year at about $8,000 each. A consistent procedure also shortens recovery for new operators.',
    },
    {
      problem:
        'Operators suggest cell improvements, but they never hear whether a change was made or whether it helped, so suggestions have dropped off.',
      proposedSolutions: [
        'Post the outcome of each implemented suggestion on the cell board with the before-and-after fault count.',
        'Ask the suggester to confirm the fix after two weeks.',
        'Review open suggestions in the weekly shift handover.',
      ],
      impactRationale:
        'Suggestions fell from 30 a quarter to 11. Most of our best cycle-time wins started as operator ideas, so reviving the loop protects that pipeline.',
    },
    {
      problem:
        'The torque-verification step piloted on line 2 cut rework, but lines 1 and 3 still use the old manual check.',
      proposedSolutions: [
        'Extend the line 2 torque verification to lines 1 and 3, one line per sprint, and track rework per line.',
      ],
      impactRationale:
        'Line 2 rework dropped from 3.1% to 1.2% after the pilot. Matching that on the other two lines avoids roughly 400 reworked assemblies a month.',
    },
    {
      problem:
        'We claim the new changeover checklist saves time, but we have no baseline, so the claim cannot be checked or used to justify the next improvement.',
      proposedSolutions: [
        'Time ten changeovers before and after the checklist on the same cells.',
        'Publish the comparison with the method so it can be repeated.',
      ],
      impactRationale:
        'A measured saving is what funds the next round of reliability work. Without it, the improvement budget request next quarter rests on anecdotes.',
    },
    {
      problem:
        'Operators still fill in a paper downtime log even though the MES records every stop, so the same data is entered twice and the two sources disagree.',
      proposedSolutions: [
        'Retire the paper log once supervisors confirm the MES downtime codes cover every stop reason.',
        'Add the two missing reason codes the paper log still captures.',
        'Archive the last six months of paper logs for audit.',
      ],
      impactRationale:
        'Removes about 10 minutes of paperwork per operator per shift and ends the reconciliation arguments in the weekly review.',
    },
  ],
  'Field service enablement': [
    {
      problem:
        'A service call passes from the call centre to dispatch to the technician, and at each step the robot serial number and fault history are retyped. Technicians often arrive without the history.',
      proposedSolutions: [
        'Create the work order from the call with the serial number and the last 90 days of faults attached.',
      ],
      impactRationale:
        'Technicians spend about 25 minutes per visit reconstructing history on site. Across 600 visits a month that is 250 technician hours.',
    },
    {
      problem:
        'Customers call us after a robot has already stopped, even though the controller logged warning codes days earlier.',
      proposedSolutions: [
        "Alert the account's service coordinator when a connected robot logs the same warning three times in 24 hours.",
        'Offer the customer a preventive visit from that alert.',
      ],
      impactRationale:
        'Unplanned downtime is the top complaint in renewal surveys. Converting even 20% of breakdowns into scheduled visits protects renewals on our largest accounts.',
    },
    {
      problem:
        'Service requests arrive by phone, email and the portal, each with different details, and about a third lack the model, firmware version or site contact.',
      proposedSolutions: [
        'Use one intake form across phone, email and portal.',
        'Make model, firmware and site contact required before dispatch.',
        "Pre-fill the form from the customer's installed base.",
      ],
      impactRationale:
        'Incomplete requests add an average of one day to response time. Complete intake is the cheapest way to meet the 48-hour service level more often.',
    },
    {
      problem:
        "Every warranty part request needs a manager's approval, even for sub-$100 consumables, so technicians wait on approvals before they can close a visit.",
      proposedSolutions: [
        'Pilot automatic approval for warranty parts under $150 with a monthly audit sample.',
      ],
      impactRationale:
        'About 70% of approvals are for low-value parts. Removing that wait closes visits a day sooner and frees managers for escalations.',
    },
    {
      problem:
        'Repeat visits to the same site for the same fault are not flagged, so a failing fix can cost three or four trips before anyone escalates.',
      proposedSolutions: [
        'Flag a work order when the same serial number has had the same fault code within 30 days.',
        'Route flagged orders to a senior technician.',
      ],
      impactRationale:
        'Repeat visits make up 18% of trips. Each avoided repeat saves about $450 in travel and labour and a frustrated customer.',
    },
    {
      problem:
        'The weekly service KPI pack (first-time fix, response time, parts usage) is built by hand from the field service tool and the ERP and takes a coordinator a full day.',
      proposedSolutions: [
        'Build the KPI pack automatically from the field service tool and ERP exports every Friday.',
      ],
      impactRationale:
        'Returns a coordinator day each week and gets regional managers the numbers before their Monday calls.',
    },
    {
      problem:
        "Diagnosis steps for common faults live in individual technicians' notebooks, so a newer technician can spend hours on a fault a veteran fixes in twenty minutes.",
      proposedSolutions: [
        'Capture diagnosis trees for the ten most common fault codes in a shared playbook.',
        'Make the playbook available offline on the service tablet.',
      ],
      impactRationale:
        'First-time fix for technicians in their first year is 61% against 84% for veterans. Closing part of that gap reduces return trips and overtime.',
    },
    {
      problem:
        'After a visit we send a survey, but low scores are not followed up, so customers never learn whether their complaint changed anything.',
      proposedSolutions: [
        'Call back every customer who scores a visit 6 or lower within two working days.',
        'Record the cause and the fix in the account history.',
        'Report the themes monthly to service leadership.',
      ],
      impactRationale:
        'Detractors who get a callback renew at almost the same rate as promoters in comparable programmes. Our service contract base is worth about $4M a year.',
    },
    {
      problem:
        'Stocking vans from a parts-usage forecast worked in the northern region, but the other three regions still stock from a fixed list.',
      proposedSolutions: [
        'Roll the forecast-based van stocking out to the remaining three regions, one per month.',
      ],
      impactRationale:
        'The northern region cut "part not on van" return trips by 35%. The same result elsewhere avoids roughly 90 trips a month.',
    },
    {
      problem:
        'Remote diagnostics was introduced to shorten visits, but we have never compared visit length with and without it, so we cannot say whether to expand it.',
      proposedSolutions: [
        'Compare on-site time for visits that used remote diagnostics with matched visits that did not.',
        'Share the result with sales for renewal conversations.',
      ],
      impactRationale:
        'Expanding remote diagnostics needs a licence spend of about $60,000. A measured time saving is what justifies it.',
    },
    {
      problem:
        'Technicians still fax signed service reports from customer sites, and the office re-enters them, even though the tablet app captures signatures.',
      proposedSolutions: [
        'Retire the fax step once billing confirms tablet signatures are accepted for invoicing.',
        'Remove the fax report template from the job pack.',
        'Tell customers the signed report now arrives by email.',
      ],
      impactRationale:
        'Re-keying takes the office about 15 hours a week and delays invoicing by two days on average.',
    },
  ],
  'Warehouse throughput': [
    {
      problem:
        'When a picker finds an empty location, they tell a supervisor, who tells a replenishment driver. The request is verbal and often forgotten when shifts change.',
      proposedSolutions: [
        'Let pickers raise a replenishment task from the handheld when a location is short.',
      ],
      impactRationale:
        'Short picks cost about 6 minutes each and we log around 300 a week, so fixing the handoff returns about 30 labour hours weekly.',
    },
    {
      problem:
        'Dock doors are overbooked on Monday mornings, and we find out when trucks are already queuing in the yard.',
      proposedSolutions: [
        'Alert the dock scheduler when bookings exceed door capacity for any two-hour window.',
        'Suggest the nearest free slot to the carrier.',
      ],
      impactRationale:
        'Yard waits above two hours trigger detention charges of about $75 an hour. Monday detention averaged $3,200 a month last quarter.',
    },
    {
      problem:
        'Inbound shipments arrive with missing ASNs or pallet counts, so receiving has to count and check every pallet before put-away.',
      proposedSolutions: [
        'Require carriers to submit an ASN with pallet counts through the booking portal.',
        'Hold dock bookings that have no ASN 24 hours out.',
        'Share a one-page receiving checklist with suppliers.',
      ],
      impactRationale:
        'Unannounced receipts take about twice as long to put away. Complete ASNs would cut receiving time by an estimated 20%.',
    },
    {
      problem:
        'Every slotting change needs sign-off from the operations manager, so fast movers stay in the back aisles for weeks after demand shifts.',
      proposedSolutions: [
        'Pilot weekly automatic re-slotting of the top 50 SKUs by velocity, reviewed after the fact.',
      ],
      impactRationale:
        'Picker travel accounts for about half of pick time. Moving fast movers forward promptly is the largest single lever on lines picked per hour.',
    },
    {
      problem:
        'Inventory discrepancies are corrected on the spot with an adjustment, but nobody looks at which locations or SKUs keep going wrong.',
      proposedSolutions: [
        'Report adjustments by location and SKU weekly and highlight repeat offenders.',
        'Trigger a cycle count on any location adjusted twice in a month.',
      ],
      impactRationale:
        'Inventory accuracy is 96.8% against a 99.5% target. Every missed pick from a phantom balance becomes a late or short customer order.',
    },
    {
      problem:
        'The weekly throughput report (lines picked, dock-to-stock time, accuracy) is compiled by hand from the WMS and takes the shift manager half a day.',
      proposedSolutions: [
        'Generate the throughput report from WMS data automatically every Monday.',
      ],
      impactRationale:
        'Returns half a manager day each week and gives site leadership comparable numbers across shifts.',
    },
    {
      problem:
        'Each shift handles a forklift near-miss differently, and some near-misses are never reported because people are unsure of the process.',
      proposedSolutions: [
        'Write one near-miss playbook covering what to stop, who to call and what to record.',
        'Post it at every dock door and forklift charging station.',
      ],
      impactRationale:
        'Our recordable incident rate is above the regional average. Consistent reporting is how we find the hazards before someone is hurt.',
    },
    {
      problem:
        'Customer complaints about mis-picks reach the account team, but the warehouse only learns about them weeks later, if at all.',
      proposedSolutions: [
        'Route every mis-pick complaint to the warehouse lead within one day.',
        'Record the root cause against the picker, location or SKU.',
        'Review the top causes in the weekly safety and quality huddle.',
      ],
      impactRationale:
        'Mis-picks cost about $40 each in returns and re-shipping, and they are the most common reason customers cite for leaving.',
    },
    {
      problem:
        'Zone picking cut walking time in the pilot aisle, but the rest of the building still uses discrete order picking.',
      proposedSolutions: [
        'Extend zone picking to the remaining aisles in three phases, measuring lines per hour per phase.',
      ],
      impactRationale:
        'The pilot aisle improved from 92 to 118 lines per hour. Building-wide, that is capacity for peak season without temporary hires.',
    },
    {
      problem:
        'We introduced pick-to-light in one zone, but nobody has compared its error rate and speed with the handheld zones.',
      proposedSolutions: [
        'Compare four weeks of error rate and lines per hour between pick-to-light and handheld zones.',
        'Publish the result with the cost per zone.',
      ],
      impactRationale:
        'Equipping the remaining zones would cost about $180,000. The comparison decides whether that is money well spent.',
    },
    {
      problem:
        'Put-away is still confirmed on paper and keyed into the WMS at the end of the shift, so stock shows as unavailable for hours after it is on the shelf.',
      proposedSolutions: [
        'Retire paper put-away once every reach truck has a working scanner mount.',
        'Stop printing put-away sheets.',
        'Train the two remaining shifts on scan confirmation.',
      ],
      impactRationale:
        'Stock sits unavailable for about four hours on average, which pushes same-day orders to the next day.',
    },
  ],
  'Route and delivery performance': [
    {
      problem:
        'Route changes are phoned from the planner to the dispatcher to the driver. Drivers sometimes miss an added stop because the message came during another delivery.',
      proposedSolutions: ['Push route changes to the driver app with a required acknowledgement.'],
      impactRationale:
        'Missed added stops cause about 40 redeliveries a month at roughly $85 each, plus a same-day promise we broke.',
    },
    {
      problem:
        'Customers learn a delivery is late only when it does not arrive, even though the telematics shows the truck behind schedule hours earlier.',
      proposedSolutions: [
        'Notify the customer automatically when the predicted arrival slips past the delivery window.',
        'Give dispatch a list of at-risk stops each morning.',
      ],
      impactRationale:
        'On-time delivery is 88% against a 95% contract target. Warning customers early protects the account even when the truck cannot be sped up.',
    },
    {
      problem:
        'Delivery requests arrive without dock hours, access codes or unloading requirements, so drivers wait on site or cannot unload at all.',
      proposedSolutions: [
        'Capture dock hours, access and unloading needs once per delivery address.',
        'Show them on the driver app at the stop.',
        'Flag orders to new addresses for a call before dispatch.',
      ],
      impactRationale:
        'Failed first attempts run at 4% of stops. Each one costs a second trip and usually a missed window on the rest of the route.',
    },
    {
      problem:
        'Every route plan is reviewed by the regional manager before release, so routes are released late in the evening and drivers get them the same morning.',
      proposedSolutions: [
        "Pilot automatic release for routes within 5% of the optimiser's planned miles, reviewing only the exceptions.",
      ],
      impactRationale:
        'Late release means loading starts late and first drops slip. Releasing by 16:00 the day before gives the warehouse time to load in route order.',
    },
    {
      problem:
        'Failed deliveries are recorded with a free-text reason, so we cannot tell whether most are access problems, customer absences or our own late arrivals.',
      proposedSolutions: [
        'Replace free text with a short list of failure reasons in the driver app.',
        'Report failures by reason and customer weekly.',
      ],
      impactRationale:
        'We make about 180 failed attempts a month. Knowing the cause is the first step to removing the largest group of them.',
    },
    {
      problem:
        'The weekly fleet report (on-time rate, miles per drop, fill rate) is compiled by hand from telematics and the TMS and is always a week behind.',
      proposedSolutions: [
        'Generate the fleet report from telematics and TMS data every Monday morning.',
      ],
      impactRationale:
        "Returns a planner day each week and lets managers act on last week's performance rather than the week before.",
    },
    {
      problem:
        'When a truck breaks down, each dispatcher handles it differently, and customers on the affected route often get no call.',
      proposedSolutions: [
        'Write one breakdown playbook: recovery, re-routing the remaining stops, and who calls each customer.',
        'Keep it in the dispatcher console with the roadside assistance numbers.',
      ],
      impactRationale:
        'We average three breakdowns a month. A consistent response keeps the other 20 drops on the route from all becoming late.',
    },
    {
      problem:
        'Customers tell drivers about problems at their site, but those notes stay in the cab and never reach planning.',
      proposedSolutions: [
        'Let drivers record site notes in the app and attach them to the delivery address.',
        'Send the planner a weekly digest of new site notes.',
        'Confirm with the customer once the note has been acted on.',
      ],
      impactRationale:
        'The same site problems cause repeat late deliveries. Fixing them once saves time on every future stop at that address.',
    },
    {
      problem:
        'Dynamic re-routing reduced miles on the two pilot routes, but the other 38 routes still follow static plans.',
      proposedSolutions: [
        'Extend dynamic re-routing to all routes in the region, ten routes a week, tracking miles per drop.',
      ],
      impactRationale:
        'The pilot routes cut miles per drop by 11%. Region-wide that is about $22,000 a month in fuel and driver time.',
    },
    {
      problem:
        'We moved to consolidated loads to raise trailer fill, but we have not checked whether the longer routes hurt on-time delivery.',
      proposedSolutions: [
        'Compare fill rate and on-time delivery for consolidated and non-consolidated routes over six weeks.',
        'Adjust the consolidation rule if on-time falls below target.',
      ],
      impactRationale:
        'A fuller trailer is only a saving if it does not cost us a contract penalty. The comparison tells us where the balance sits.',
    },
    {
      problem:
        'Drivers still carry paper delivery notes for signatures and hand them in at the end of the day, even though the app captures proof of delivery.',
      proposedSolutions: [
        'Retire paper delivery notes once the three customers who require them accept electronic proof of delivery.',
        'Stop printing notes for all other customers now.',
        'Email the signed proof to the customer automatically.',
      ],
      impactRationale:
        'Paper notes delay invoicing by about three days and are lost on roughly 1% of deliveries, which leads to disputed invoices.',
    },
  ],
}
