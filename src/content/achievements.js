// Copy from the original achievements page. Photos are the ones that still exist on the old host;
// Picture32k19, Picture32k18, gg04, gg010, gg011 and DSC_5786–57810 were already missing there.
// 2016's 30th overall is from the team's "Performance over the years" slide.
export const RECORD = [
  {
    year: '2026', title: 'Aircraft Olympics', summary: '4th place',
    points: ['4th place at the Aircraft Olympics.'],
    caption: 'At Pradarshana', photos: ['Copy_of_DSC_5785'], // the same photo as 2024 for now
  },
  {
    year: '2024', event: 'Technoxian World Cup', title: 'Pradarshana-24', summary: 'Cleared every round of the Technoxian World Cup 2024',
    points: ['Cleared every round of the Technoxian World Cup 2024, a national competition.', 'Showed the aircraft at Pradarshana-24.'],
    caption: 'At Pradarshana', photos: ['Copy_of_DSC_5785'],
  },
  {
    // From the plaque and field photos in the gallery (Apollo XI field, Van Nuys).
    year: '2022', title: 'SAE Aero Design West', summary: '2nd place, Regular Class Written Design Report',
    points: ['2nd place in the Regular Class Written Design Report at SAE Aero Design West 2022.', 'Flew at the Apollo XI field in Van Nuys, California.'],
    photos: [
      'https://1drv.ms/i/c/4577d5d6291c48d0/IQQFNPdkqipJQKRzV3bFGUQlAUqdQtLZBz_GBkTAQaRFMbk?width=1080&height=902',
      'https://1drv.ms/i/c/4577d5d6291c48d0/IQSeS7fvo7y4QbOmz2Dwus8GAdKelfk304H6EaPvVvcqE6o?width=682&height=954',
      'https://1drv.ms/i/c/4577d5d6291c48d0/IQSblUY-_13AQ4WVqP0CDhuqAVdSQ9YJ4tMOY7GmkcI9b3s?width=1080&height=961',
      'https://1drv.ms/i/c/4577d5d6291c48d0/IQQrDeI-PWtbQYAhcmkv04pnAfzj3IJo9u8Da9V7xNzfz6s?width=924&height=620',
      'https://1drv.ms/i/c/4577d5d6291c48d0/IQTy-Jsk1fNkTY0RNo9X3SUeAe2E87--PM7frMSgC4DYzx0?width=850&height=626',
    ],
  },
  {
    year: '2019', summary: '5th overall',
    points: ['5th overall.', '7th for the technical design report.', '15th for the technical presentation.'],
    photos: ['Picture12k19', 'Picture22k19'],
  },
  {
    year: '2018', summary: '7.25 kg lifted, highest in Asia in round three',
    points: [
      '7th in the flight rounds, and the team’s first successful flight round.',
      'Lifted 7.25 kg (16 lb) in total, the highest in Asia in the third round.',
      '10th in the oral presentation.',
      'Bonus presentation points for an innovative fuselage design.',
    ],
    photos: ['Picture12k18', 'Picture22k18', 'Picture42k18', 'Picture52k18', 'Picture62k18', 'Picture72k18', 'Picture82k18', 'Picture92k18', 'Picture102k18', 'Picture112k18', 'Picture122k18'],
  },
  {
    year: '2017', title: 'Qriosity', summary: '12th overall, 2nd in Asia',
    points: [
      '12th overall and 2nd in Asia.',
      'Qriosity flew with an elliptical wing for better performance.',
      '8th in the world and 1st in Asia in the presentation rounds.',
    ],
    photos: ['gg01', 'gg02', 'gg03', 'gg05', 'gg06', 'gg07', 'gg08', 'gg09'],
  },
  {
    year: '2016', summary: '30th overall, 5th in the world for payload',
    points: [
      '30th overall and 5th in the world for payload lifted.',
      'Carried 12.5 kg, a team record.',
      'Improved the wing structure.',
      'Reached the finals.',
    ],
    photos: ['Picture31'],
  },
  {
    year: '2015', summary: '13.6 kg lifted, highest by an Indian team',
    points: [
      '15th overall in the team’s first year.',
      '11th for maximum payload, lifting 13.6 kg.',
      'The highest payload an Indian team had carried in the competition’s history.',
    ],
    photos: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  },
].sort((a, b) => b.year - a.year); // newest first, whatever order years are added in

export const FIRST_YEAR = RECORD.at(-1)?.year, LATEST_YEAR = RECORD[0]?.year;
