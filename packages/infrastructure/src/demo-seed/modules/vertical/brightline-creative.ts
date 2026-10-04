import type { DemoOrganizationScenario } from '../scenario.js'

export const BRIGHTLINE_CREATIVE: DemoOrganizationScenario = {
  title: 'Brightline Creative',
  slug: 'brightline-creative',
  description:
    'Full-service marketing agency covering brand, content, paid media and social for about twelve client accounts.',
  sprintGoal:
    'Cut first-round creative approval turnaround to two business days on the five largest retainers.',
  accounts: [
    {
      firstName: 'Camille',
      lastName: 'Durand',
      localPart: 'orgadmin',
      role: 'OrgAdmin',
    },
    {
      firstName: 'Dana',
      lastName: 'Whitfield',
      localPart: 'user',
      role: 'User',
    },
    {
      firstName: 'Theo',
      lastName: 'Lindqvist',
      localPart: 'user2',
      role: 'User',
    },
    {
      firstName: 'Julian',
      lastName: 'Ellery',
      localPart: 'readonly',
      role: 'ReadOnly',
    },
  ],
  boards: [
    {
      name: 'Ideas',
      description:
        'Campaign ideas, channel experiments and creative concepts that win and grow client accounts.',
      focus: 'Client campaigns',
      tagNames: ['paid-media', 'short-form-video', 'creative-testing', 'retention'],
      commentBodies: [
        'Retail is the right pilot: their product turns over fast enough that we will see a CPA signal inside three weeks. I can draft the test plan with a 60/40 split between video and static.',
        'Agreed. Keep the pilot budget under 15% of their monthly paid social spend so the client does not feel exposed, and I will brief the editors on a 15-second cut-down format.',
        "Pulling last quarter's top ten static ads now to see which hooks are worth rebuilding as a 20-second chain. Initial read is that the founder story outperforms product shots by roughly 30%.",
      ],
      checklists: [
        [
          {
            title: 'Agree pilot budget and success metric with the client',
            state: 'Done',
            assignee: 2,
          },
          { title: 'Script three 15-second hooks', state: 'Done', assignee: 1 },
          { title: 'Shoot and edit first batch of six cuts', state: 'InProgress', assignee: 1 },
          { title: 'Set up A/B test against current static ads', state: 'NotStarted', assignee: 0 },
        ],
        [
          {
            title: 'Pull ten best-performing static ads from last quarter',
            state: 'Done',
            assignee: 2,
          },
          { title: 'Tag each ad by hook type and offer', state: 'InProgress', assignee: 1 },
          {
            title: 'Build the shared creative testing tracker',
            state: 'NotStarted',
            assignee: null,
          },
        ],
      ],
      ideas: [
        {
          title: 'Short-form video pilot for a retail client',
          description:
            'Test 15-second vertical video ads against static creative for a high-volume retail account.',
          problem:
            'The retail client spends $42K a month on paid social with static images that have plateaued at a $38 CPA. Frequency is climbing above 4.5 and click-through has fallen 22% since spring.',
          proposedSolutions: [
            'Produce six 15-second vertical cuts from existing product footage and run them in a 60/40 test against statics.',
            'Brief two creators for native-style unboxing videos as a second variant.',
          ],
          impactRationale:
            'If video brings CPA down to $30, the account saves roughly $8K a month at the same volume. A proven format also gives us a repeatable offer for three other retail prospects.',
        },
        {
          title: 'Creative testing tracker across all paid accounts',
          description: 'A single shared log of every ad variant tested, its hook, and its result.',
          problem:
            "Test results live in each strategist's own spreadsheet, so the same hooks get retested across clients. Last quarter two teams ran near-identical headline tests within three weeks of each other.",
          proposedSolutions: [
            'Create one tracker with fields for hook type, offer, format, spend and CPA, filled in at test close.',
            'Add a monthly 30-minute review where winning patterns are shared across account teams.',
          ],
          impactRationale:
            'Avoiding even four duplicate tests a quarter frees about $6K of media spend for new learning. It also shortens new-strategist ramp-up on creative patterns.',
        },
        {
          title: 'Quarterly social audit offered as a paid add-on',
          description:
            "Package a structured audit of a client's social presence as a $3,500 add-on.",
          problem:
            'Clients regularly ask for a "quick look" at their channels, and we absorb 8 to 12 unbilled hours each time. There is no defined scope, so the findings are inconsistent between strategists.',
          proposedSolutions: [
            'Define a fixed audit scope covering content mix, cadence, engagement and competitor benchmarks.',
            'Offer it at $3,500 per quarter with a 90-minute readout.',
          ],
          impactRationale:
            'Converting half of the twelve accounts would add about $21K a year in billable work. It also surfaces upsell opportunities in paid and content.',
        },
        {
          title: 'Lifecycle email nurture for a SaaS client',
          description:
            'Build a five-email onboarding and reactivation sequence to lift trial-to-paid conversion.',
          problem:
            "The SaaS client's trial-to-paid rate is 9% and 61% of trial users never return after day two. Their current onboarding is a single welcome email.",
          proposedSolutions: [
            'Write a five-email sequence keyed to activation events on days 0, 2, 5, 9 and 14.',
            'Add a short reactivation branch for users who go quiet after the first session.',
          ],
          impactRationale:
            'Lifting trial-to-paid from 9% to 11% on 1,800 monthly trials is about 36 extra customers a month. At their $49 plan price that is roughly $21K in new annual revenue per month.',
        },
        {
          title: 'Influencer seeding program for a beverage launch',
          description: 'Seed product to 40 micro-influencers ahead of a regional beverage launch.',
          problem:
            'The beverage client launches in six weeks with a $25K social budget and no audience in the region. Paid reach alone would cover under 15% of the target market.',
          proposedSolutions: [
            'Seed 40 micro-influencers in the target metros with a kit and a light brief.',
            'Whitelist the best five posts as paid ads to extend reach.',
          ],
          impactRationale:
            'Micro-influencer content typically delivers engagement at a third of the cost of brand-made creative. A successful seed would add an estimated 400K organic impressions in launch month.',
        },
        {
          title: 'Always-on UGC library for e-commerce accounts',
          description:
            'Maintain a rolling bank of customer-generated content licensed for use in paid ads.',
          problem:
            'E-commerce clients burn through new creative every three weeks and we rebuild assets from scratch each time. Customer photos sit unused in tagged posts and review emails.',
          proposedSolutions: [
            'Set up a simple rights-request flow for tagged customer posts.',
            'Tag approved assets by product and use case in a shared library.',
          ],
          impactRationale:
            'Reusing licensed UGC can cut new-asset production by about 25 hours a month per account. UGC ads also tend to beat studio creative on CPA by 15% to 20%.',
        },
        {
          title: 'Paid search to paid social retargeting loop',
          description:
            'Retarget search visitors who did not convert with a tailored social creative sequence.',
          problem:
            'Three B2B clients capture search traffic at a $14 CPC but 94% of visitors leave without converting. We do not currently follow up with any social retargeting.',
          proposedSolutions: [
            'Build search-visitor audiences and serve a three-step creative sequence on LinkedIn and Meta.',
            'Cap retargeting spend at 20% of the search budget.',
          ],
          impactRationale:
            'Recovering even 1.5% of lost visitors on 8,000 monthly clicks yields about 120 more leads a month. That would reduce blended cost per lead by roughly 18%.',
        },
        {
          title: 'Podcast clip repurposing for a financial services client',
          description: 'Turn each weekly podcast episode into six short clips and a written recap.',
          problem:
            'The client records a 40-minute episode every week but only posts the full audio. The social team has no time to cut clips, so the content reaches under 800 listeners.',
          proposedSolutions: [
            'Use an AI transcript to pick six clip moments per episode and cut them with captions.',
            'Publish a 400-word recap on the blog with the clips embedded.',
          ],
          impactRationale:
            'Clip distribution should triple weekly reach to about 2,500 within two months. It adds roughly 14 hours of billable production a month without new shoots.',
        },
        {
          title: 'Seasonal campaign calendar shared with clients',
          description:
            'A single rolling calendar of seasonal moments and campaign deadlines visible to every client.',
          problem:
            'Clients often request a holiday campaign with under three weeks to go, forcing rush rates and weak creative. Last Q4 five accounts asked for work inside two weeks of the deadline.',
          proposedSolutions: [
            'Publish a shared 12-month calendar of peak moments with briefing deadlines at 8 weeks out.',
            'Send a reminder at each briefing deadline.',
          ],
          impactRationale:
            'Briefing at 8 weeks removes most rush work, saving about 60 overtime hours across Q4. It also gives clients a visible reason to book earlier.',
        },
        {
          title: 'Competitor ad library monitoring for retail accounts',
          description:
            'Weekly capture of competitor ads from public ad libraries, summarized for each account team.',
          problem:
            'Account teams check competitor ads ad hoc and often miss new offers until a client forwards them. Responses to competitor promotions currently lag by about two weeks.',
          proposedSolutions: [
            'Capture competitor ads weekly from public ad libraries and file them by account.',
            'Add a one-paragraph summary of new offers to the Monday standup.',
          ],
          impactRationale:
            'Cutting response time to under three days helps clients counter promotions in the same week. It also gives strategists proof points for quarterly reviews.',
        },
        {
          title: 'Brand voice quiz for new client discovery',
          description:
            'A ten-question interactive quiz used in discovery calls to pin down tone of voice.',
          problem:
            'New clients describe their voice in vague words like "friendly but professional", which leads to two or three rounds of copy revisions. Voice misalignment caused 31% of first-round copy rejections last quarter.',
          proposedSolutions: [
            'Build a ten-question quiz mapped to four voice axes and run it in the discovery call.',
            'Attach the resulting voice profile to the creative brief.',
          ],
          impactRationale:
            'Halving first-round copy rejections saves about 6 hours of revision per new client. It also makes discovery feel more distinctive in pitches.',
        },
      ],
    },
    {
      name: 'Opportunities',
      description:
        'Briefs, approvals, utilization, reporting and onboarding: how the agency runs behind the client work.',
      focus: 'Agency operations',
      tagNames: ['briefs', 'approvals', 'utilization', 'reporting'],
      commentBodies: [
        'A single brief template is the cheapest fix we have. Last month three of my campaigns restarted because the audience and success metric were missing from the first brief.',
        'Good. Draft it with required fields for audience, single objective, budget and approver, and we will make the project board refuse a kickoff without it.',
        'Trial it on the next five new briefs before rolling it out. If it saves more than a day of back-and-forth per brief, we make it mandatory.',
      ],
      ideas: [
        {
          title: 'One-page creative brief template',
          description:
            'A single required brief template with audience, objective, budget and approver fields.',
          problem:
            'Briefs arrive as emails, decks and chat messages with different fields, and 40% are missing a measurable objective. Missing information causes an average of 1.8 days of clarification before work starts.',
          proposedSolutions: [
            'Create a one-page template with required fields for audience, single objective, budget, deadline and approver.',
            'Block project kickoff until the template is complete.',
          ],
          impactRationale:
            'Removing one day of clarification per brief returns about 25 working days a month across the studio. It also reduces scope disputes with clients.',
        },
        {
          title: 'Two-stage client approval workflow',
          description:
            'Split approvals into a quick internal check and a single consolidated client review.',
          problem:
            'Assets go to clients with up to five reviewers, each replying separately, and the average first-round approval takes 6.5 business days. Conflicting feedback forces extra rounds on 35% of assets.',
          proposedSolutions: [
            'Name one client approver per account and collect feedback in a single consolidated review.',
            'Add a 24-hour internal quality check before anything is sent.',
          ],
          impactRationale:
            'Targeting a 3-day average turnaround would pull two weeks of delay out of a typical campaign. It also lowers revision rounds from 3.1 to about 2.',
        },
        {
          title: 'Weekly utilization dashboard by role',
          description: 'A live view of billable hours against capacity for each role and account.',
          problem:
            'Utilization is reported monthly from timesheets, so overload and idle time are visible only after the fact. Designers ran at 112% last month while two copywriters sat near 58%.',
          proposedSolutions: [
            'Build a weekly dashboard of logged hours against capacity by role.',
            'Flag anyone over 95% or under 65% for the Monday staffing review.',
          ],
          impactRationale:
            'Rebalancing a 15-point gap between roles recovers roughly 90 billable hours a month, about $11K at blended rates. It also reduces burnout risk on the design team.',
        },
        {
          title: 'Client onboarding checklist with access requests',
          description:
            'A standard checklist that gathers logins, brand assets and approvals in the first week.',
          problem:
            'New clients take an average of 17 days to supply ad account access and brand files, delaying launch. Account managers chase the same items by email for each new client.',
          proposedSolutions: [
            'Send a single onboarding portal link on day one listing every access request and asset.',
            'Track completion on a shared checklist with a day-5 escalation.',
          ],
          impactRationale:
            'Cutting the delay to 7 days gets retainer revenue flowing 10 days earlier. At a $9K average retainer that is about $3K pulled forward per new client.',
        },
        {
          title: 'Automated monthly client performance report',
          description:
            'Generate the monthly report from live ad and analytics data instead of building it by hand.',
          problem:
            'Strategists spend 5 to 7 hours per client each month assembling reports from screenshots and exports. Across twelve accounts that is about 70 hours of non-billable time.',
          proposedSolutions: [
            'Connect ad platforms and analytics to a templated report that refreshes automatically.',
            'Leave a short commentary section for the strategist to complete.',
          ],
          impactRationale:
            'Cutting reporting to 1.5 hours per client frees about 50 hours a month. That is roughly $6K of capacity at blended rates, redirected to strategy.',
        },
        {
          title: 'Freelancer bench and rate card',
          description: 'Maintain a vetted freelancer roster with agreed rates and availability.',
          problem:
            'When a project spikes we scramble for freelancers and pay ad hoc rates that run 20% above our usual. Last quarter we lost two days finding an animator for a launch deadline.',
          proposedSolutions: [
            'Vet and onboard 12 freelancers across design, motion, copy and video with agreed rates.',
            'Keep availability in a shared sheet updated each Friday.',
          ],
          impactRationale:
            'Standard rates save about 20% on overflow work, near $4K a quarter. Faster staffing also protects delivery dates on spikes.',
        },
        {
          title: 'Scope change request form',
          description: 'A short form that records and prices every out-of-scope client request.',
          problem:
            'Out-of-scope requests are accepted verbally and absorbed, leaving an estimated 9% of retainer hours unbilled. Nobody can show a client how much extra work was done.',
          proposedSolutions: [
            'Add a form capturing the request, estimated hours and price, approved by the account lead.',
            'Review accumulated changes in the quarterly business review.',
          ],
          impactRationale:
            'Recovering a third of the unbilled 9% adds about $32K a year across the portfolio. It also gives clients clearer boundaries.',
        },
        {
          title: 'Asset naming and storage standard',
          description:
            'A fixed naming convention and folder structure for creative files across all clients.',
          problem:
            'Final files are named inconsistently, so people spend an average of 12 minutes finding the approved version. Two campaigns went out last quarter with a superseded logo.',
          proposedSolutions: [
            'Adopt client_campaign_asset_version naming and a standard folder tree.',
            'Add an Approved folder that only account leads can write to.',
          ],
          impactRationale:
            'Saving 12 minutes on 40 searches a week returns about 8 hours weekly. It also removes the risk of publishing outdated brand assets.',
        },
        {
          title: 'Quarterly business review deck template',
          description:
            'A standard quarterly review deck pairing results with next-quarter recommendations.',
          problem:
            "Each account lead builds their own review deck, taking 8 hours on average and varying widely in quality. Clients rarely see a clear link between results and the next quarter's plan.",
          proposedSolutions: [
            'Create a 12-slide template with results, learnings, risks and recommendations.',
            'Pre-fill charts from the monthly report data.',
          ],
          impactRationale:
            'Cutting build time to 3 hours saves about 60 hours a quarter across twelve accounts. A consistent format also improves retainer renewal conversations.',
        },
        {
          title: 'Proposal library for new business',
          description:
            'A reusable library of scoped service packages and case studies for pitches.',
          problem:
            "Every proposal is written from scratch and takes about 14 hours, with pricing varying by author. We won only 22% of last quarter's pitches.",
          proposedSolutions: [
            'Build modular service packages with fixed pricing tiers.',
            'Keep a bank of six case studies mapped to client industries.',
          ],
          impactRationale:
            'Reducing proposal time to 6 hours saves 8 hours a pitch. Consistent pricing and tailored proof points should lift win rate toward 30%.',
        },
        {
          title: 'Monthly retainer hours burn-down view',
          description:
            'Show account leads and clients how much of each retainer has been used mid-month.',
          problem:
            'Overruns surface only at month end, and four accounts exceeded their retainer by more than 15% last quarter. Clients are surprised by overage conversations.',
          proposedSolutions: [
            'Show hours used against hours contracted on a weekly burn-down chart.',
            'Alert the account lead at 75% and 90% consumption.',
          ],
          impactRationale:
            'Catching overruns two weeks earlier lets us renegotiate scope or bill overage, protecting an estimated $2.5K a month in margin.',
        },
      ],
    },
  ],
}
