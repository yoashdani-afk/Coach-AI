export const EXAMPLE_ANALYSIS = {
  id: 'example',
  title: 'Coach Me',
  summary:
    'Mostly yes — your idea to play forward was good, but one extra scan would have confirmed the pass was on.',
  dateLabel: 'Example report',
  isExample: true as const,
};

export const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Select a clip',
    body: 'Pick 10 seconds to 5 minutes from training or a match.',
  },
  {
    step: '2',
    title: 'Choose a coaching mode',
    body: 'Coach Me, Rate My Performance, or Rate This Goal — one mode per clip.',
  },
  {
    step: '3',
    title: 'Identify yourself',
    body: 'Tap your position in the frame so the coach follows the right player.',
  },
  {
    step: '4',
    title: 'Get your report',
    body: 'Review your demo report, save it, and track progress over time.',
  },
] as const;
