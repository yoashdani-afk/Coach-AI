export const EXAMPLE_ANALYSIS = {
  id: 'example',
  title: 'Coach Me',
  summary:
    'What happened: you opened on the half-turn and played forward as the pressing trigger activated. Why it mattered: one pre-contact scan would have confirmed whether the weak-side lane was still open before you committed.',
  dateLabel: 'Example report',
  isExample: true as const,
};

export const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Upload your clip',
    body: 'Choose a clip between 10 seconds and 5 minutes from training or a match.',
  },
  {
    step: '2',
    title: 'Pick a coaching mode',
    body: 'Analyze My Performance, Rate This Goal, or Coach Me — one focus per upload.',
  },
  {
    step: '3',
    title: 'Tag yourself in the frame',
    body: 'Tap your player so coaching follows you, not a teammate.',
  },
  {
    step: '4',
    title: 'Read your report',
    body: 'Get a scored breakdown you can save and revisit anytime.',
  },
] as const;
