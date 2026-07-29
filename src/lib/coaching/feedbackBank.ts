import { pickVariant } from '@/lib/coaching/structuredFeedback';
import type { StructuredCoachFeedback } from '@/lib/coaching/structuredFeedback';

/** Pick unique items from a pool using a base seed and index — reduces phrase collision within one report. */
export function pickAt<T>(pool: T[], seed: number, index: number): T {
  return pool[(seed + index * 7) % pool.length];
}

export function composeParagraph(segments: string[]): string {
  return segments.filter(Boolean).join(' ');
}

// ─── Coach Me ───────────────────────────────────────────────────────────────

export interface CoachMeContent {
  verdict: string;
  didWell: string[];
  couldImprove: string[];
  betterOption: string;
  trainingTakeaway: string;
}

type CoachCtx = {
  positionLabel: string;
  footLabel: string;
  contextNote: string | null;
  customQuestion?: string;
  seed: number;
};

export function coachMeContent(
  questionType: string,
  ctx: CoachCtx
): CoachMeContent {
  const builders: Record<string, (c: CoachCtx) => CoachMeContent[]> = {
    RIGHT_DECISION: rightDecisionVariants,
    BETTER_OPTION: betterOptionVariants,
    POSITIONING: positioningVariants,
    TECHNIQUE: techniqueVariants,
    DID_WELL: didWellVariants,
    CUSTOM: customVariants,
  };
  const pool = builders[questionType]?.(ctx) ?? customVariants(ctx);
  return pickVariant(pool, ctx.seed);
}

function rightDecisionVariants(ctx: CoachCtx): CoachMeContent[] {
  return [
    {
      verdict:
        'What happened: you opened on the half-turn and fed the central lane as the near defender stepped to the ball-side. Why it mattered: the pass arrived into a corridor where the pressing trigger was already live — one beat earlier the lane existed, one beat later it was shut.',
      didWell: [
        'Scan before receive gave you half a picture — your head was up, which is why the forward pass was even available.',
        `Body shape as a ${ctx.positionLabel.toLowerCase()} showed intent to link the transition rather than recycle possession.`,
        ctx.contextNote,
      ].filter(Boolean) as string[],
      couldImprove: [
        'Shoulder check did not confirm the third-man run — you played on partial information, which is why the second defender could step.',
        'First touch was neutral instead of into the passing lane, costing the half-second that would have beaten the press.',
      ],
      betterOption:
        'A professional operator holds one beat, confirms weak-side space with a single scan, then releases to the supporting angle. If the trigger is set, secure with a negative pass — the restart is cheaper than the turnover.',
      trainingTakeaway:
        'Scanning-and-receive rondo (12×12): call the colour of a cone behind you before first touch. No pass until the call is made — twelve reps per foot.',
    },
    {
      verdict:
        'What happened: you carried forward with the defender goal-side and no third-man movement off the ball. Why it mattered: the transition advantage disappeared because the overload never formed — you ran into pressure instead of passing it.',
      didWell: [
        'Tempo on receive was positive — you did not allow the moment to stall, which kept defenders adjusting.',
        'Balance through the carry meant a pass or set was still physically possible on the second action.',
      ],
      couldImprove: [
        'Movement off the ball was static — no blind-side run meant the passing lane never opened.',
        'Decision to carry was made before scanning weak-side space, so the picture was incomplete when you committed.',
      ],
      betterOption:
        'Elite players set one touch wide, draw the press, then find the third-man run or switch. The carry is the last option, not the first, when the central lane is congested.',
      trainingTakeaway:
        '4v4+3 with two-touch cap in the middle third: verbal call naming the third-man runner before every forward pass. Rotate every four minutes.',
    },
    {
      verdict:
        'What happened: you played the safe pass sideways when a forward lane was opening for one beat. Why it mattered: the sideways pass reset the press but killed the vertical momentum — the window closed before the second action.',
      didWell: [
        'You retained possession under an active trigger — that composure prevented a turnover in a dangerous zone.',
        'Touch was clean enough to allow any decision on the second beat.',
      ],
      couldImprove: [
        'Scan timing was late — you saw the forward lane after the first touch, not before the ball arrived.',
        'Hips were closed on receive, which made the forward pass a two-touch action instead of one.',
      ],
      betterOption:
        'Receive open, scan pre-contact, and if the lane is on, play first-time or one-touch forward. If not, then secure — professionals do not default sideways when the picture favours verticality.',
      trainingTakeaway:
        'Receive-and-forward corridor drill: partner plays in; you must scan and play forward within two seconds if the gate is open — eight reps, rotate server.',
    },
    {
      verdict:
        'What happened: you switched play correctly but your first touch after the switch sat under your body. Why it mattered: the horizontal stretch worked, but the second action invited the counter-press because the touch did not open the next lane.',
      didWell: [
        'Recognition of the overload was correct — you identified ball-side congestion and chose the weak side.',
        'Pass weight on the switch was appropriate, which gave you a chance to attack on the second phase.',
      ],
      couldImprove: [
        'First touch after the switch must travel into space, not to feet — inward touches donate time to the nearest presser.',
        'Body orientation after the switch was square; a half-turn would have preserved the forward option.',
      ],
      betterOption:
        'Take the switch, open hips on the first touch toward the largest space, and play forward on the second. The switch is only valuable if the second action exploits the shift.',
      trainingTakeaway:
        'Switch-and-attack pattern: wide player receives switch, one touch into cone zone, forward pass within three seconds. Ten cycles each flank.',
    },
  ];
}

function betterOptionVariants(ctx: CoachCtx): CoachMeContent[] {
  return [
    {
      verdict:
        'What happened: the wide player was free on the weak side when you turned into central traffic. Why it mattered: you removed the horizontal stretch that had created the 2v1 — the defence recovered shape without being punished.',
      didWell: [
        'You survived the press on the first action — possession was still alive for a different choice.',
        'Touch under pressure was secure, which meant the error was decisional, not technical.',
      ],
      couldImprove: [
        'No scan to the weak side before committing — the free player was unmarked for three seconds.',
        'Pass into the overload activated the pressing trigger the opponent wanted.',
      ],
      betterOption: `Release early to the ${ctx.footLabel.toLowerCase()}-side supporting angle with one controlled pass. A professional winger or full-back in that space changes the picture entirely — force the block to shift before you attack.`,
      trainingTakeaway:
        '3v2 rondo with two wide neutrals: point to the free neutral before every pass. Turnover if you play into a marked player without pointing.',
    },
    {
      verdict:
        'What happened: you attempted a line-breaking pass through a closing window. Why it mattered: rest-defence was exposed — a turnover in the central corridor becomes a direct transition against a flat shape.',
      didWell: [
        'You recognised the moment to play forward — the intent to break lines is required at your stage.',
        'Strike/pass technique was clean even if the choice was low-percentage.',
      ],
      couldImprove: [
        'The safe pass to the nearest free teammate was available on the first touch.',
        'You did not use your body to shield before deciding, so the defender closed the lane in one step.',
      ],
      betterOption:
        'Secure with a body-shielded lay-off, let the block shift, then play the third-man run. Progression is sequential — professionals build the highlight over three actions, not one.',
      trainingTakeaway:
        'Positional 5v5+2: six passes before a forward line-break; breaking a marked corridor costs possession.',
    },
    {
      verdict:
        'What happened: you dribbled into a double-team when a simple pass was on. Why it mattered: the 1v2 eliminated the transition — carrying into pressure is only correct when space ahead is real, not imagined.',
      didWell: [
        'Close control in tight space was secure — the ball stayed with you until the trap closed.',
        'You protected the ball with your body, which delayed the turnover by one second.',
      ],
      couldImprove: [
        'Head was down during the carry — the pass was available earlier if you had scanned.',
        'Tempo increased under pressure instead of slowing to find the free man.',
      ],
      betterOption:
        'Release before the trap sets. A professional midfielder passes the problem to the weak side and moves again — the carry comes after the defence shifts, not before.',
      trainingTakeaway:
        'Press trap escape: 3v3 in 12×12, two defenders trap on trigger — attackers score by finding the free player in four passes or fewer.',
    },
  ];
}

function positioningVariants(ctx: CoachCtx): CoachMeContent[] {
  return [
    {
      verdict:
        'What happened: you arrived square on the defender’s vertical line when the pass was played. Why it mattered: you became passive to mark and blind to the runner behind — the passing lane to weak-side space never existed.',
      didWell: [
        'Goal-side starting position was correct in the first phase.',
        'You tracked the ball with intent when the switch was played.',
      ],
      couldImprove: [
        'Spacing to the ball carrier was too tight — you could not see ball and runner simultaneously.',
        'Adjustment came after the pass arrived; elite players reposition before the ball travels.',
      ],
      betterOption:
        'Hold the weak-side half-space line side-on, two metres wider, and scan as the pass travels. Receive facing forward on the half-turn — professionals adjust pre-contact.',
      trainingTakeaway:
        'Shadow defending: jockey side-on, shoulder check every two seconds. Partner calls “switch” — reposition before the pass is played.',
    },
    {
      verdict:
        'What happened: you drifted ball-side during the switch, compressing space for the carrier. Why it mattered: the switch needs a weak-side outlet — without it, the horizontal pass becomes a turnover under pressure.',
      didWell: [
        'Initial compactness helped the first line of pressure.',
        'Recovery run when the ball moved showed work rate in transition.',
      ],
      couldImprove: [
        'Movement off the ball was reactive — you arrived after the lane closed.',
        'No supporting angle on the weak side meant the overload never formed.',
      ],
      betterOption:
        'Time the run to arrive on the weak-side line as the pass travels. Distance: close enough to connect, wide enough to stretch the block — professionals create the angle before demanding the ball.',
      trainingTakeaway:
        'Wide overload 4v4: mandatory weak-side switch within six seconds; third-man run after every horizontal stretch.',
    },
    {
      verdict:
        'What happened: you were flat-footed when the ball switched flanks. Why it mattered: one step late meant the passing lane to the runner was open for one beat only — you missed the window because your set position was ball-side.',
      didWell: [
        'Awareness to recover toward the ball once the switch was in flight.',
        'Communication to the nearest teammate once pressure activated.',
      ],
      couldImprove: [
        'Anticipation of the switch was missing — body weight was still oriented ball-side.',
        'Scan frequency dropped when the ball was far from you — that is when the picture changes fastest.',
      ],
      betterOption:
        'As the ball travels across the pitch, shift weight side-on and check the runner behind. Professionals treat off-ball moments as active scanning periods, not rest.',
      trainingTakeaway:
        'Switch anticipation drill: coach plays switch; you must touch the far cone before receive — forces early repositioning.',
    },
  ];
}

function techniqueVariants(ctx: CoachCtx): CoachMeContent[] {
  return [
    {
      verdict:
        'What happened: your plant foot was narrow and hips were not set toward target at contact. Why it mattered: the strike travelled across the ball — power leaked sideways and placement suffered under defensive pressure.',
      didWell: [
        `You committed with the ${ctx.footLabel.toLowerCase()} foot when the window was live — hesitation would have closed the option entirely.`,
        'Head stayed over the ball through contact, which prevented a skyed attempt.',
      ],
      couldImprove: [
        'Non-kicking foot was behind the line of the ball, limiting forward weight transfer.',
        'Follow-through was cut short because balance was not set before the action.',
      ],
      betterOption:
        'Plant beside the ball, hips at target, locked ankle through the centre of the ball. Professionals accept one extra touch to set if it improves body orientation — quality over speed.',
      trainingTakeaway:
        'Wall striking through a one-metre gate: twenty reps per foot, plant-foot cone placement mandatory. No rep counts without gate success.',
    },
    {
      verdict:
        'What happened: first touch and strike were combined in one motion. Why it mattered: you were still adjusting body shape as you hit — contact point was unstable, which is why placement was inconsistent.',
      didWell: [
        'You did not snatch at the ball — the attempt was controlled under pressure.',
        'Decision to act in the window was correct even if execution blurred two actions.',
      ],
      couldImprove: [
        'Touch did not set the ball into the path of the strike — separate the actions.',
        'Supporting foot was too close, forcing an awkward swing path.',
      ],
      betterOption:
        'Cushion set with the inside foot, step, then strike when hips are fully open. Elite finishers separate touch and shot unless the one-touch is deliberately trained.',
      trainingTakeaway:
        'Two-touch circuit: wide serve, set into marked zone, strike on second. Ten reps from each angle — measure consistency of placement.',
    },
  ];
}

function didWellVariants(ctx: CoachCtx): CoachMeContent[] {
  return [
    {
      verdict:
        'What happened: you scanned pre-contact, received on the half-turn, and played forward while the pressing trigger was still developing. Why it mattered: that sequence preserved the passing lane and kept the transition alive — the defence was reacting to you, not pressing you.',
      didWell: [
        'Scan timing was before first touch, so your body orientation matched the picture you built.',
        `Decision fit the ${ctx.positionLabel.toLowerCase()} role — link forward without forcing the central corridor.`,
        'Composure under pressure retained possession for the next action instead of clearing into a 50-50.',
        ctx.contextNote,
      ].filter(Boolean) as string[],
      couldImprove: [
        'Arrive half a step earlier next time — the habit is right, the timing can sharpen.',
        'Verbal call before receive was missing — a loud “time” accelerates the third-man run.',
      ],
      betterOption:
        'Repeat this scan-touch-pass pattern when weak-side space is available. Professionals make this automatic — add one communication cue before every receive to lift the team dimension.',
      trainingTakeaway:
        'Video-to-pitch: rewatch this clip once, then ten receives in a rondo copying the same scan and half-turn.',
    },
    {
      verdict:
        'What happened: you held the weak-side line, received side-on, and played the switch that broke the overload. Why it mattered: horizontal stretch forced the block to shift — that created the vertical lane on the second action.',
      didWell: [
        'Positioning before the pass was side-on — you could see ball and runner without turning.',
        'Pass weight on the switch was measured, which allowed the receiver to play forward first time.',
        'Movement off the ball created the angle — you did not demand the ball in a square position.',
      ],
      couldImprove: [
        'Second action after the switch could have been one touch quicker.',
        'Scan after the switch was missing — the forward lane closed while you secured.',
      ],
      betterOption:
        'Maintain this weak-side discipline every switch. Professionals treat the first touch after a switch as the most valuable action in build-up.',
      trainingTakeaway:
        'Switch-and-play sequence: twelve switches per session, receiver must play forward within three seconds or rep resets.',
    },
  ];
}

function customVariants(ctx: CoachCtx): CoachMeContent[] {
  const q = ctx.customQuestion ?? 'this moment';
  return [
    {
      verdict: `What happened: your question — "${q}" — centres on a phase where scan timing, body orientation, and first-touch direction decided whether the team progressed or reset. Why it mattered: those three details determine if the pressing trigger beats you or you beat it.`,
      didWell: [
        'You stayed engaged when the ball entered your zone — concentration is the baseline for any correction.',
        ctx.contextNote,
      ].filter(Boolean) as string[],
      couldImprove: [
        'Decision landed one beat after the pressing trigger — the picture was still forming when you committed.',
        'Closed body shape on receive removed weak-side options before first touch.',
      ],
      betterOption:
        'Open on the half-turn, scan once pre-contact, play the supporting angle or secure if the lane shuts. Professionals trust the simple action when the highlight is not on.',
      trainingTakeaway:
        'Write one cue from this clip. First twelve minutes of next session: rondo with that cue mandatory before every forward pass.',
    },
    {
      verdict: `What happened: regarding "${q}", the clip shows you receiving with closed hips while the weak-side lane was opening. Why it mattered: that body shape forced a second touch, which is exactly when the nearest defender activated the pressing trigger.`,
      didWell: [
        'You did not turn away from the ball under pressure — engagement in the phase was constant.',
        ctx.contextNote,
      ].filter(Boolean) as string[],
      couldImprove: [
        'Scan before receive was absent — the forward pass was attempted on partial information.',
        'Touch direction was inward, which removed the supporting angle on the second action.',
      ],
      betterOption:
        'Open on the half-turn before contact, confirm weak-side space once, then play the supporting pass or secure. Professionals do not commit forward until the picture includes the third-man runner.',
      trainingTakeaway:
        'Scanning rondo: verbalise the weak-side option before first touch — coach stops play if the call comes after contact.',
    },
  ];
}

// ─── Performance ─────────────────────────────────────────────────────────────

export function performanceStrength(category: string, score: number, seed: number): string {
  const pools: Record<string, string[]> = {
    DECISION_MAKING: [
      `Decision making (${score}/10): you delayed release until the pressing trigger was clear, then played the supporting angle — that tempo protected rest-defence in transition.`,
      `Decision making (${score}/10): the switch to weak-side space was chosen over forcing the central lane, which recreated horizontal stretch and broke the overload.`,
      `Decision making (${score}/10): you rejected the low-percentage line-break and secured possession — professionals accept the restart when the picture is incomplete.`,
    ],
    POSITIONING: [
      `Positioning (${score}/10): you held the half-space line side-on, preserving the passing lane while staying blind-side of the nearest marker.`,
      `Positioning (${score}/10): spacing to the ball carrier was correct — close enough to link, wide enough to see the third-man run.`,
      `Positioning (${score}/10): goal-side discipline in the first phase meant you were not caught flat when the switch arrived.`,
    ],
    SCANNING: [
      `Scanning (${score}/10): shoulder check before first touch meant body orientation matched the picture you built pre-contact.`,
      `Scanning (${score}/10): you checked weak-side space before the ball arrived — the forward pass was planned, not reactive.`,
    ],
    MOVEMENT: [
      `Movement (${score}/10): third-man run timed to the pass — you arrived on the supporting angle as the ball travelled, not after contact.`,
      `Movement (${score}/10): off-ball run stretched the block horizontally before you received — the overload formed because of your movement, not despite it.`,
      `Work rate (${score}/10): recovery run when possession turned over was immediate, which limited the counter-attack lane.`,
    ],
    FIRST_TOUCH: [
      `First touch (${score}/10): touch travelled into the passing lane with hips open — touch direction equalled the next decision.`,
      `First touch (${score}/10): half-turn receive eliminated a second adjustment and preserved the transition window.`,
    ],
    COMPOSURE: [
      `Composure (${score}/10): under an active pressing trigger you secured with a body-shielded lay-off instead of clearing into traffic.`,
      `Composure (${score}/10): tempo did not rise when pressure arrived — one extra touch to set shape beat a rushed second action.`,
    ],
    COMMUNICATION: [
      `Communication (${score}/10): verbal call before receive organised the third-man run — teammates adjusted before the pass, not after.`,
      `Tactical awareness (${score}/10): you directed the press with an early call, setting defensive shape before the trigger activated.`,
    ],
  };
  return pickAt(pools[category] ?? [`${category} (${score}/10) enabled the next action rather than reacting to it.`], seed, 0);
}

export function performanceImprovement(category: string, score: number, seed: number): string {
  const pools: Record<string, string[]> = {
    DECISION_MAKING: [
      `Decision making (${score}/10): you committed into the central corridor before the scan confirmed the third-man run — the pressing trigger won because the picture was incomplete.`,
      `Decision making (${score}/10): low-percentage pass into traffic broke rest-defence; the safe supporting angle was available one touch earlier.`,
      `Consistency (${score}/10): the correct decision appeared in one phase but the next action reverted under pressure — habits must survive the full sequence.`,
    ],
    POSITIONING: [
      `Positioning (${score}/10): you arrived square on the defender's vertical line, removing the weak-side passing lane.`,
      `Positioning (${score}/10): ball-side drift during the switch compressed space for the carrier instead of offering a supporting angle.`,
    ],
    SCANNING: [
      `Scanning (${score}/10): scan came after first touch — by then the pressing trigger was active and weak-side space had closed.`,
      `Scanning (${score}/10): no shoulder check before receive — body orientation was guessing rather than informed.`,
    ],
    MOVEMENT: [
      `Movement (${score}/10): off-ball positioning was reactive — you arrived after the lane closed instead of timing the run to the pass.`,
      `Work rate (${score}/10): intensity dropped when the ball was far from you — professionals stay active in the scanning phase even without the ball.`,
    ],
    FIRST_TOUCH: [
      `First touch (${score}/10): touch sat under the body, inviting the pressing trigger before the second action could open the lane.`,
      `First touch (${score}/10): closed receive required an extra touch to open hips — that donated half a second to the press.`,
    ],
    COMPOSURE: [
      `Composure (${score}/10): tempo rose under pressure and the clearance became a 50-50 in a dangerous zone.`,
      `Composure (${score}/10): second action was rushed because the first touch did not create a secure passing lane.`,
    ],
    COMMUNICATION: [
      `Communication (${score}/10): silent receive — teammates could not time the third-man run because the call came after contact.`,
      `Tactical awareness (${score}/10): no press call before the trigger — defensive shape set late and the lane stayed open one beat too long.`,
    ],
  };
  return pickAt(pools[category] ?? [`${category} (${score}/10) limited the team's next action.`], seed, 1);
}

export function performanceSummary(
  firstName: string,
  position: string,
  level: string,
  top: string,
  topScore: number,
  bottom: string,
  bottomScore: number,
  overall: number,
  seed: number
): string {
  const pools = [
    `${firstName}, as a ${level.toLowerCase()} ${position.toLowerCase()}, ${top.toLowerCase()} (${topScore}/10) consistently enabled progression while ${bottom.toLowerCase()} (${bottomScore}/10) broke the sequence under pressure. Demo composite ${overall}/10 — tactical awareness is present; consistency under the pressing trigger is the gap.`,
    `Phase review: work rate and movement were adequate, but ${bottom.toLowerCase()} (${bottomScore}/10) cost half a second in transition. Strongest habit: ${top.toLowerCase()} (${topScore}/10). Demo rating ${overall}/10 — fix one detail per session, not five.`,
    `Clip analysis for ${firstName}: positioning and decision making diverged — ${top.toLowerCase()} (${topScore}/10) versus ${bottom.toLowerCase()} (${bottomScore}/10). Overall demo score ${overall}/10. Elite academy standard is repeatable behaviour across the full phase, not one good action.`,
    `${firstName}'s ${level.toLowerCase()} clip shows ${top.toLowerCase()} (${topScore}/10) as the platform and ${bottom.toLowerCase()} (${bottomScore}/10) as the leak. Demo ${overall}/10. Composure held in one moment but not the next — that inconsistency is what we train next.`,
  ];
  return pickAt(pools, seed, 2);
}

export function performanceTraining(category: string, foot: string, seed: number): string {
  const pools: Record<string, string[]> = {
    DECISION_MAKING: [
      '4v4+3: six passes before forward line-break; passer points to target before release.',
      '3v2 rondo with wide neutrals: point to free player before every pass.',
      'Press escape 3v3: find the free player within four passes when trap activates.',
    ],
    POSITIONING: [
      'Shadow defending side-on: shoulder check every two seconds; reposition on “switch” call before pass.',
      'Half-space receive drill: reps do not count if you arrive square to the ball.',
    ],
    SCANNING: [
      'Partner calls cone colour behind you — shoulder check before first touch mandatory.',
      'Scanning rondo: verbalise weak-side picture before touch; coach verifies.',
    ],
    MOVEMENT: [
      'Third-man runs: new angle within two seconds after every pass in rondo.',
      'Wide overload 4v4: switch through weak channel within six seconds.',
    ],
    FIRST_TOUCH: [
      `Wall receiving (${foot.toLowerCase()} foot): touch to cone zone two metres away — twenty reps, partner calls direction.`,
      'Pressured 2v1 box: open on first touch, play out within two seconds.',
    ],
    COMPOSURE: [
      'Pressured possession box: panicked clearances cost a point; shielded lay-offs rewarded.',
      'Two-touch limit in middle third: extra touch only after scan call.',
    ],
    COMMUNICATION: [
      'Verbal call before every receive this week — “time”, “turn”, or “man on”.',
      'Pressing shape game: defender calls trigger before step or possession switches.',
    ],
  };
  return pickAt(pools[category] ?? ['Video-to-pitch rondo with one written cue from this clip — twelve minutes.'], seed, 3);
}

// ─── Goal analysis ───────────────────────────────────────────────────────────

export function buildGoalWhyAnalysis(
  overall: number,
  position: string,
  level: string,
  seed: number
): string {
  const run = pickAt(
    [
      'The run before the goal curved behind the nearest defender’s blind side, arriving as the pass was played rather than after — that timing kept you onside and unmarked for one beat.',
      'Movement off the ball was the setup: a diagonal run from deep broke the line as the wide player fixed the full-back, creating the channel for the pass.',
      'The run was understated — you held the near-post line, then peeled to the back post when the crosser lifted their head, which is why the space opened late.',
      'You checked the shoulder once during the run, which confirmed the centre-back was ball-watching — that scan is why you accelerated into the gap at the right moment.',
    ],
    seed,
    0
  );
  const touch = pickAt(
    [
      'First touch was positive into the path of the shot — cushion with the inside foot, ball travelled away from the recovering defender rather than under your body.',
      'The touch was a single adjustment across the body, opening hips toward goal without a second settle — that saved the half-second the keeper needed to set.',
      'First touch in the box was tight but controlled — you did not kill momentum with a heavy cushion, which is why the strike window stayed open.',
      'Receive was on the move: touch forward into the shooting lane rather than dead at feet — professionals treat the touch as the start of the finish.',
    ],
    seed,
    1
  );
  const body = pickAt(
    [
      'Body position at strike was side-on with hips over the ball — weight forward, not leaning back, which is why placement stayed low.',
      'You arrived with the defender on your back but got your body between ball and opponent before contact — that separation created the space for the swing.',
      'Chest stayed over the ball through contact; head steady, which prevented the scuff that often comes when players snatch at one-touch chances.',
      'Plant foot beside the ball, knee over the line of the shot — body shape transferred power through the ball instead of across it.',
    ],
    seed,
    2
  );
  const finish = pickAt(
    [
      'Finishing technique: inside-foot strike across the keeper into the far corner — toe down, ankle locked, contact through the centre of the ball for placement over power.',
      'Technique was a placed side-foot finish when power would have sent it at the keeper’s chest — the choice of foot surface matched the angle.',
      'Strike was first-time with the laces when the bounce was kind — low trajectory because the contact point was below the equator of the ball.',
      'One-touch finish through traffic — you adjusted the angle with the inside of the foot rather than taking a second touch that would have invited the block.',
    ],
    seed,
    3
  );
  const gk = pickAt(
    [
      'The goalkeeper was set near-post; you exploited the far corner with placement — correct read of keeper position.',
      'Keeper was advancing; you passed into the side netting rather than blasting central — that decision on placement beat the spread.',
      'Goalkeeper shape was narrow; the strike into the far side exploited the open angle before the second post could be covered.',
    ],
    seed,
    4
  );
  const difficulty = pickAt(
    [
      'Difficulty was elevated by defensive pressure arriving as you struck — not a static shooting drill, a live transition moment.',
      'Angle was tight and the defender was goal-side — the finish had to be precise because a block was imminent.',
      'Composure under pressure separated this from a rushed clearance — you slowed the final action when others would have snatched.',
    ],
    seed,
    5
  );

  return composeParagraph([
    run,
    touch,
    body,
    finish,
    gk,
    difficulty,
    `Demo Score ${overall}/10 for this ${level.toLowerCase()} ${position.toLowerCase()} — generated locally, not AI video analysis.`,
  ]);
}

export function goalExcellentPoint(seed: number): string {
  return pickAt(
    [
      'What made the finish successful: placement beat power — you chose the corner the keeper could not reach because body shape stayed low through contact.',
      'The finish worked because timing beat the recovering runner — release was inside the one-beat window before the lane closed.',
      'Success came from touch direction into the shooting lane — you did not settle under your body, so the strike was one continuous action.',
      'Finishing succeeded because you read keeper position and passed into the far side — elite strikers finish to the open corner, not the largest target.',
      'The combination of positive first touch and locked ankle at contact meant placement was repeatable — technique under pressure, not luck.',
    ],
    seed,
    6
  );
}

export function goalImprovementPoint(seed: number): string {
  return pickAt(
    [
      'Elevation: a first-time finish from the same angle would have increased difficulty — the second touch gave the keeper time to set and the block to form.',
      'The run could start half a step earlier — you arrived as the pass was played, not before, which removed one passing option.',
      'Plant foot could be wider for more power without sacrificing placement — the far corner was still reachable with a more stable base.',
      'One more scan before the shot might have revealed a square pass for a tap-in — the finish was correct but not the highest-value option.',
      'First touch in the box was slightly heavy — that donated half a second to the recovering defender and forced a tighter strike than necessary.',
    ],
    seed,
    7
  );
}

// ─── Coach Chat (DemoCoach) ──────────────────────────────────────────────────

export type ChatIntent =
  | 'WRONG_DECISION'
  | 'BETTER_OPTION'
  | 'SPACE'
  | 'FIRST_TOUCH'
  | 'DRILL'
  | 'STRENGTH'
  | 'IMPROVEMENT'
  | 'GENERAL';

export function buildChatFeedback(
  intent: ChatIntent,
  ctx: {
    alternative?: string;
    training?: string;
    reportVerdict?: string;
    reportSummary?: string;
  },
  seed: number
): StructuredCoachFeedback {
  const whatPools: Record<ChatIntent, string[]> = {
    WRONG_DECISION: [
      'You received with closed hips and played forward into a central lane that was already under the pressing trigger — the scan came after the first touch, not before.',
      'You carried into a double-team with the defender goal-side and no third-man run off the ball — the transition window closed because the overload never formed.',
      'You played forward on partial information: the weak-side picture was incomplete when you committed, which is why the second defender could step into the passing lane.',
      'The pass was logical in direction but late in timing — the lane existed for one beat before the near defender activated the pressing trigger.',
    ],
    BETTER_OPTION: [
      'The wide player was free on the weak side when you turned back into central traffic where two defenders had collapsed the lane.',
      'A line-breaking pass was attempted through a window that had closed — the nearest free teammate was available on the first touch.',
      'You dribbled into pressure when a body-shielded lay-off would have preserved possession and shifted the block.',
      'The switch was on, but you played back into the ball-side overload instead of stretching the pitch horizontally.',
    ],
    SPACE: [
      'You stayed on the defender’s vertical line, arriving square when the pass was played into your feet.',
      'You drifted ball-side during the switch, compressing space for the carrier instead of holding the weak-side half-space line.',
      'Your supporting angle was too tight to the ball carrier — you could not see both ball and runner behind you.',
      'Movement off the ball was reactive: you arrived after the passing lane closed rather than timing the run to the pass.',
    ],
    FIRST_TOUCH: [
      'The first touch sat under your body instead of travelling into the space in front — the defender closed the distance before your second action.',
      'You received on your back foot with a closed shape, forcing a second touch to open your body before playing forward.',
      'The touch was neutral rather than positive — it did not create a passing lane, only maintained possession under pressure.',
      'Cushion was heavy into traffic — the ball stopped where the pressing trigger was already active.',
    ],
    DRILL: [
      'The clip confirms a recurring pattern under pressure that matches the priority in your written report — the same habit appears at the frame you selected.',
      'Match footage shows the detail we flagged in analysis: decision and touch diverge when the pressing trigger activates.',
    ],
    STRENGTH: [
      ctx.reportVerdict ??
        'You scanned pre-contact, opened on the half-turn, and played forward while the pressing trigger was still developing.',
      'You held the weak-side line side-on and played the switch that broke the overload — horizontal stretch came from positioning, not luck.',
      'First touch travelled into the passing lane with hips open — touch direction matched the next decision.',
    ],
    IMPROVEMENT: [
      ctx.reportVerdict ??
        'You committed before the defensive shape revealed the free supporting angle — the overload broke because the second action was early.',
      'Scan timing was late relative to the pressing trigger — the picture was still forming when you played forward.',
      'Body shape on receive was closed, which removed weak-side options before first touch.',
    ],
    GENERAL: [
      ctx.reportVerdict ??
        'The phase turned on scan timing, body orientation, and whether the first touch opened or closed the next lane.',
      ctx.reportSummary ??
        'You were involved in a transition where the first two actions decided whether the press was escaped or triggered.',
    ],
  };

  const whyPools: Record<ChatIntent, string[]> = {
    WRONG_DECISION: [
      'That sequence eliminated weak-side options and forced a low-percentage pass — in transition, the first action sets the press for the entire team.',
      'The decision burned the transition advantage: once blocked, the counter-press had a clear target and rest-defence was flat.',
      'Playing on partial information invites the pressing trigger — the cost is not one turnover but the second ball against an unset shape.',
      'Late commitment means the defender sets the trigger before you execute — you react to pressure instead of controlling tempo.',
    ],
    BETTER_OPTION: [
      'You removed the horizontal stretch that created the advantage — playing into the overload handed initiative back to the opponent.',
      'Low-percentage passes in build-up break rest-defence — the team cannot set if the first pass is turned over centrally.',
      'Carrying into a set trap donates possession in the exact zone where the counter-attack starts.',
      'Without weak-side support, the switch becomes a turnover — movement off the ball creates overloads, standing ball-side removes them.',
    ],
    SPACE: [
      'Square body orientation blocks the runner behind you and removes the weak-side passing lane — marking becomes passive on one line.',
      'Without weak-side support, the switch fails under pressure — the horizontal pass needs an outlet that only movement creates.',
      'Tight spacing removes dual vision of ball and runner — you cannot play forward and track the third man simultaneously.',
      'Reactive movement arrives after the lane closes — professionals time the run to the pass, not to the receive.',
    ],
    FIRST_TOUCH: [
      'An inward or heavy first touch activates the pressing trigger — the touch is your decision before the second action exists.',
      'The extra touch is the window where the press arrives — in tight areas, receive quality equals possession.',
      'Neutral touches maintain but do not progress — under pressure, only positive touch direction creates the next lane.',
      'Heavy cushions stop the ball where defenders are converging — transition speed dies on the first contact.',
    ],
    DRILL: [
      'Training must recreate the decision and the pressure — isolated technique without context does not transfer to match footage.',
      'Match analysis confirms what the session must target: one habit under pressure, repeated until automatic.',
    ],
    STRENGTH: [
      'That sequence preserved the passing lane — when you receive facing forward, the defender reacts to you, not the reverse.',
      'Horizontal stretch forced the block to shift — the second action existed because the first was tactically correct.',
      'Positive touch direction linked directly to the next decision — that is why the transition survived the press.',
    ],
    IMPROVEMENT: [
      'Early commitment removes team options and invites the counter-press — rest-defence pays the price on the second ball.',
      'Incomplete pictures lead to low-percentage actions — the pressing trigger wins when the scan is after the touch.',
      'Closed shape on receive is a predictable pattern — opponents set the trap knowing the first touch will be inward.',
    ],
    GENERAL: [
      ctx.reportSummary ??
        'That moment sat inside a larger transition — first actions shaped whether the press was escaped or triggered.',
      'Post-match analysis returns to one question: when did you know what you wanted to do, and did the first touch enable it?',
    ],
  };

  const betterPools: Record<ChatIntent, string[]> = {
    WRONG_DECISION: [
      ctx.alternative ??
        'Open hips to half-turn before the ball arrives, scan weak-side once, play the supporting angle. If the lane shuts, secure with a negative pass.',
      'Set one touch wide, draw the press, find the third-man run or switch — patience in the first two seconds creates the 2v1 you tried to force manually.',
      'Hold one beat, confirm the third-man runner, then release — professionals pass the press rather than run through it.',
    ],
    BETTER_OPTION: [
      ctx.alternative ??
        'Switch early to the weak-side supporting angle; if pressed, body-shield and rebuild the overload.',
      'Secure with a lay-off, let the block shift, play the third-man run on the second action — progression is sequential.',
      'Release before the trap sets — pass the problem to the weak side and move again.',
    ],
    SPACE: [
      'Adjust two metres wider before the pass arrives, receive side-on on the half-turn, touch into the supporting angle.',
      'Hold the weak-side half-space line; time the run to arrive as the pass travels, not after.',
      'Shift weight side-on as the ball switches; check the runner behind before the ball arrives at your feet.',
    ],
    FIRST_TOUCH: [
      'Cushion diagonally into space with hips pre-opened toward the next target — one positive touch creates the lane.',
      'Half-turn on the front foot; ball travels across the body into the path of the next pass after one pre-contact scan.',
      'Touch away from pressure into the largest space — touch direction must equal next action.',
    ],
    DRILL: [
      'Structure the next three sessions around one cue from this clip — mastery of one habit under pressure beats scattered work.',
      'Pick one non-negotiable behaviour from the report and repeat it in constrained small-sided games before adding chaos.',
    ],
    STRENGTH: [
      'Replicate scan timing, touch direction, and tempo whenever weak-side space is open — consistency earns trust.',
      'Make weak-side discipline automatic on every switch — the second action is the valuable one.',
    ],
    IMPROVEMENT: [
      ctx.alternative ??
        'Delay one beat, scan weak-side, play the supporting angle or secure — the half-second preserves the overload.',
      'Open pre-contact, trust the simple pass when the highlight is not on — professionals keep the ball to keep the picture building.',
    ],
    GENERAL: [
      ctx.alternative ??
        'Pre-scan, half-turn receive, supporting angle or switch when the central lane is overloaded.',
      'One scan, one positive touch, one decision — reduce the phase to those three beats.',
    ],
  };

  const insightPools: Record<ChatIntent, string[]> = {
    WRONG_DECISION: [
      'Elite players build the picture before the pass is played — scanning is part of receiving, not a separate action.',
      'Tempo in transition is controlled by the first touch — slow it to speed the second action.',
      'Decision quality at academy level is about information, not bravery — partial pictures produce partial outcomes.',
    ],
    BETTER_OPTION: [
      'If two defenders occupy your lane, the solution is rarely a third attempt through the same corridor — pass the problem away.',
      'The safe pass often creates the unsafe opportunity two actions later because it moves the block.',
      'Professionals progress in sequences — the highlight is pass three, not pass one.',
    ],
    SPACE: [
      'Reposition before the ball travels — adjust after receiving and the pressing trigger is already set.',
      'Supporting angles depend on distance and timing: too close kills space, too late kills the lane.',
      'Off-ball scanning periods are active — the picture changes fastest when the ball is far from you.',
    ],
    FIRST_TOUCH: [
      'Touch direction equals next action — if the touch does not point where you will play, body orientation was wrong pre-contact.',
      'Half-turn receiving under pressure separates players who play through the press from those who survive it.',
      'Separate touch and strike in the box unless one-touch is deliberately trained — blurred actions lose placement.',
    ],
    DRILL: [
      'Professional environments repeat constraints until behaviour is automatic, then add chaos — you cannot skip the constrained phase.',
      'One habit per block of sessions — scatter produces scatter.',
    ],
    STRENGTH: [
      'Repeatable habits in transition are what coaches select for — flash moments matter less than scan timing and body orientation.',
      'Horizontal stretch is a team weapon — your positioning created it, not the pass alone.',
    ],
    IMPROVEMENT: [
      'If you cannot see the third-man run, the professional choice is to keep the ball — force only when the picture is complete.',
      'Inconsistency under the same pressing trigger means the habit is not yet automatic — that is what we train next.',
    ],
    GENERAL: [
      'Academy analysis always returns to: when did you decide, and did the first touch enable or block that decision?',
      'Transitions are won or lost in two touches — everything else is commentary.',
    ],
  };

  const drillPools: Record<ChatIntent, string[]> = {
    WRONG_DECISION: [
      ctx.training ??
        'Scanning-and-receive rondo (12×12): call cone colour behind you before first touch — twelve reps per foot.',
      '4v4+3 two-touch cap: name the third-man runner before every forward pass.',
    ],
    BETTER_OPTION: [
      ctx.training ??
        '3v2 rondo with wide neutrals: point to free player before every pass.',
      'Positional 5v5+2: six passes before line-break; breaking a marked corridor costs possession.',
    ],
    SPACE: [
      ctx.training ??
        'Shadow defending side-on: shoulder check every two seconds; reposition on “switch” before pass.',
      'Wide overload 4v4: mandatory weak-side switch within six seconds.',
    ],
    FIRST_TOUCH: [
      ctx.training ??
        'Wall receiving: touch to cone zone two metres away — partner calls direction pre-release, twenty reps.',
      'Pressured 2v1 box: open on first touch, play out within two seconds.',
    ],
    DRILL: [
      ctx.training ??
        'Scanning-and-receive rondo: ten successful sequences before rotate; scan must precede contact.',
    ],
    STRENGTH: [
      ctx.training ??
        'Video-to-pitch: rewatch clip once, ten rondo receives copying the same scan and touch direction.',
    ],
    IMPROVEMENT: [
      ctx.training ??
        'Decision delay rondo: coach calls “hold” — two touches before release to build scan-while-secure habit.',
    ],
    GENERAL: [
      ctx.training ??
        'Write one cue on a card; twelve-minute rondo with cue mandatory before every forward pass.',
    ],
  };

  return {
    whatHappened: pickAt(whatPools[intent], seed, 0),
    whyItMattered: pickAt(whyPools[intent], seed, 1),
    betterOption: pickAt(betterPools[intent], seed, 2),
    professionalInsight: pickAt(insightPools[intent], seed, 3),
    trainingDrill: pickAt(drillPools[intent], seed, 4),
  };
}

