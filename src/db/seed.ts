import { db } from './database.js';
import { hashPassword } from '../utils/password.js';
import type { Database } from './types.js';

type NewNotification = Omit<
  Database['notifications'],
  'notification_id' | 'created_at' | 'icon' | 'action_label' | 'is_read'
> & {
  icon: string;
  action_label: string;
  is_read: boolean;
};

const MINUTE = 60_000;

function nextWeekday(weekday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  const diff = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hhmm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

export async function seed() {
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.ALLOW_PRODUCTION_SEED
  ) {
    throw new Error(
      'Refusing to wipe and seed a production database. Set ALLOW_PRODUCTION_SEED=1 to override.',
    );
  }

  console.log('Seeding sample data that matches the Huddle design...');

  for (const table of [
    'email_outbox',
    'support_tickets',
    'notifications',
    'open_time_blocks',
    'event_invites',
    'events',
    'group_invites',
    'group_members',
    'groups',
    'user_notification_preferences',
    'refresh_tokens',
    'users',
  ] as const) {
    await db.deleteFrom(table).execute();
  }

  const passwordHash = await hashPassword('password123');

  const namedUsers = [
    { name: 'You', email: 'you@example.com', color: 'blue' },
    { name: 'Ava', email: 'ava@example.com', color: 'blue' },
    { name: 'Marcus', email: 'marcus@example.com', color: 'green' },
    { name: 'Priya', email: 'priya@example.com', color: 'pink' },
    { name: 'Jon', email: 'jon@example.com', color: 'amber' },
    { name: 'Lena', email: 'lena@example.com', color: 'violet' },
  ];
  const fillerNames = [
    'Noah',
    'Mia',
    'Liam',
    'Zoe',
    'Owen',
    'Ruby',
    'Eli',
    'Nora',
    'Theo',
    'Iris',
    'Sam',
    'Maya',
    'Ben',
    'Elena',
    'Omar',
    'Hana',
    'Kai',
    'Tara',
  ];
  const colors = ['blue', 'green', 'amber', 'pink', 'violet'];
  const fillers = fillerNames.map((name, i) => ({
    name,
    email: `${name.toLowerCase()}@example.com`,
    color: colors[i % colors.length],
  }));

  const users = new Map<
    string,
    { user_id: number; name: string; email: string }
  >();
  for (const u of [...namedUsers, ...fillers]) {
    const row = await db
      .insertInto('users')
      .values({
        name: u.name,
        email: u.email,
        password_hash: passwordHash,
        avatar_color: u.color,
      })
      .returning(['user_id', 'name', 'email'])
      .executeTakeFirstOrThrow();
    users.set(u.name, row);

    await db
      .insertInto('user_notification_preferences')
      .values({
        user_id: row.user_id,
        pref_invites: true,
        pref_confirmed: true,
        pref_email: false,
      })
      .execute();
  }
  const uid = (name: string) => users.get(name)!.user_id;
  console.log(`Created ${users.size} users (password for all: password123).`);

  const groupDefs = [
    {
      name: 'Study Crew',
      color: 'blue',
      owner: 'Ava',
      description:
        'Weekly study sessions that only happen when enough of us can make it.',
      members: ['Ava', 'Marcus', 'Priya', 'Jon', 'Lena', 'You'],
    },
    {
      name: 'Friday Pickup Soccer',
      color: 'green',
      owner: 'Marcus',
      description: 'Casual Friday pickup soccer matches.',
      members: ['Marcus', 'You', ...fillerNames.slice(0, 12)],
    },
    {
      name: 'Roommates',
      color: 'amber',
      owner: 'Priya',
      description: 'Apartment dinners and roommate chores.',
      members: ['Priya', 'You', 'Noah', 'Mia'],
    },
    {
      name: 'Book Club',
      color: 'pink',
      owner: 'Marcus',
      description: 'Monthly book readings and chapter discussions.',
      members: [
        'Marcus',
        'You',
        'Ava',
        'Lena',
        'Zoe',
        'Owen',
        'Ruby',
        'Eli',
        'Nora',
      ],
    },
    {
      name: 'Hack Night',
      color: 'violet',
      owner: 'Jon',
      description: 'Weekend coding and hackathon project builds.',
      members: [
        'Jon',
        'You',
        'Ava',
        'Theo',
        'Iris',
        'Sam',
        'Maya',
        'Ben',
        'Elena',
        'Omar',
        'Hana',
      ],
    },
  ];

  const groups = new Map<string, { group_id: number; name: string }>();
  for (const g of groupDefs) {
    const row = await db
      .insertInto('groups')
      .values({
        name: g.name,
        description: g.description,
        color: g.color,
        created_by: uid(g.owner),
      })
      .returning(['group_id', 'name'])
      .executeTakeFirstOrThrow();
    groups.set(g.name, row);

    await db
      .insertInto('group_members')
      .values(
        g.members.map((m) => ({
          group_id: row.group_id,
          user_id: uid(m),
          role: m === g.owner ? ('Admin' as const) : ('Member' as const),
        })),
      )
      .execute();
  }
  const gid = (name: string) => groups.get(name)!.group_id;
  console.log(`Created ${groups.size} groups.`);

  await db
    .insertInto('group_invites')
    .values({
      group_id: gid('Roommates'),
      email: 'you@example.com',
      user_id: uid('You'),
      invited_by: uid('Priya'),
      status: 'accepted',
    })
    .execute();
  await db
    .insertInto('group_invites')
    .values({
      group_id: gid('Study Crew'),
      email: 'newcomer@example.com',
      user_id: null,
      invited_by: uid('Ava'),
    })
    .execute();

  async function createEvent(input: {
    group: string;
    creator: string;
    name: string;
    minutes: number;
    needs: number;
    status: 'Waiting for people' | 'Confirmed';
    start?: Date;
    invites: Array<[name: string, response: 'pending' | 'yes' | 'no']>;
  }) {
    const end = input.start
      ? new Date(input.start.getTime() + input.minutes * MINUTE)
      : null;
    const event = await db
      .insertInto('events')
      .values({
        group_id: gid(input.group),
        created_by: uid(input.creator),
        name: input.name,
        min_duration_minutes: input.minutes,
        min_attendees: input.needs,
        status: input.status,
        confirmed_start_time: input.start ?? null,
        confirmed_end_time: end,
      })
      .returning(['event_id', 'group_id'])
      .executeTakeFirstOrThrow();

    if (input.invites.length > 0) {
      await db
        .insertInto('event_invites')
        .values(
          input.invites.map(([name, response]) => ({
            event_id: event.event_id,
            email: users.get(name)!.email,
            user_id: uid(name),
            invited_by: uid(input.creator),
            response,
          })),
        )
        .execute();
    }
    return event;
  }

  async function addBlocks(
    eventId: number,
    names: string[],
    start: Date,
    minutes: number,
  ) {
    const end = new Date(start.getTime() + minutes * MINUTE);
    await db
      .insertInto('open_time_blocks')
      .values(
        names.map((n) => ({
          event_id: eventId,
          user_id: uid(n),
          date: isoDate(start),
          start_time: hhmm(start),
          end_time: hhmm(end),
        })),
      )
      .execute();
  }

  const saturday = nextWeekday(6, 14);
  const studySession = await createEvent({
    group: 'Study Crew',
    creator: 'Ava',
    name: 'Saturday study session',
    minutes: 120,
    needs: 4,
    status: 'Waiting for people',
    invites: [
      ['You', 'pending'],
      ['Marcus', 'yes'],
      ['Priya', 'no'],
      ['Jon', 'pending'],
    ],
  });
  await addBlocks(studySession.event_id, ['Ava', 'Marcus'], saturday, 180);

  const linearAlgebra = await createEvent({
    group: 'Study Crew',
    creator: 'Marcus',
    name: 'Linear algebra problem set',
    minutes: 90,
    needs: 3,
    status: 'Waiting for people',
    invites: [
      ['Ava', 'pending'],
      ['Priya', 'pending'],
    ],
  });
  await addBlocks(linearAlgebra.event_id, ['Marcus'], nextWeekday(2, 17), 120);

  const midterm = nextWeekday(3, 16);
  const midtermReview = await createEvent({
    group: 'Study Crew',
    creator: 'Ava',
    name: 'Midterm review',
    minutes: 180,
    needs: 5,
    status: 'Confirmed',
    start: midterm,
    invites: [
      ['Marcus', 'yes'],
      ['Priya', 'yes'],
      ['Jon', 'yes'],
      ['Lena', 'yes'],
    ],
  });
  await addBlocks(
    midtermReview.event_id,
    ['Ava', 'Marcus', 'Priya', 'Jon', 'Lena'],
    midterm,
    180,
  );

  const coffee = nextWeekday(1, 15);
  const coffeeEvent = await createEvent({
    group: 'Study Crew',
    creator: 'Jon',
    name: 'Coffee and flashcards',
    minutes: 60,
    needs: 2,
    status: 'Confirmed',
    start: coffee,
    invites: [
      ['Lena', 'yes'],
      ['Priya', 'yes'],
    ],
  });
  await addBlocks(coffeeEvent.event_id, ['Jon', 'Lena', 'Priya'], coffee, 60);

  const bookEvent = await createEvent({
    group: 'Book Club',
    creator: 'Marcus',
    name: 'Chapter 6 discussion',
    minutes: 60,
    needs: 5,
    status: 'Waiting for people',
    invites: [
      ['You', 'pending'],
      ['Ava', 'yes'],
      ['Lena', 'yes'],
      ['Zoe', 'pending'],
    ],
  });

  await createEvent({
    group: 'Book Club',
    creator: 'Ava',
    name: 'Pick the next book',
    minutes: 60,
    needs: 4,
    status: 'Waiting for people',
    invites: [
      ['Marcus', 'yes'],
      ['Lena', 'pending'],
      ['Owen', 'pending'],
    ],
  });

  const friday = nextWeekday(5, 18, 30);
  const pickup = await createEvent({
    group: 'Friday Pickup Soccer',
    creator: 'Marcus',
    name: 'Pickup game',
    minutes: 90,
    needs: 4,
    status: 'Confirmed',
    start: friday,
    invites: [
      ['You', 'yes'],
      ['Noah', 'yes'],
      ['Mia', 'yes'],
    ],
  });
  await addBlocks(
    pickup.event_id,
    ['Marcus', 'You', 'Noah', 'Mia'],
    friday,
    90,
  );

  const sunday = nextWeekday(0, 19);
  const hack = await createEvent({
    group: 'Hack Night',
    creator: 'Jon',
    name: 'Hack night kickoff',
    minutes: 180,
    needs: 3,
    status: 'Confirmed',
    start: sunday,
    invites: [
      ['You', 'yes'],
      ['Ava', 'yes'],
    ],
  });
  await addBlocks(hack.event_id, ['Jon', 'You', 'Ava'], sunday, 180);

  const dinner = nextWeekday(3, 19, 30);
  const dinnerEvent = await createEvent({
    group: 'Roommates',
    creator: 'Priya',
    name: 'Apartment dinner',
    minutes: 90,
    needs: 3,
    status: 'Confirmed',
    start: dinner,
    invites: [
      ['You', 'yes'],
      ['Noah', 'yes'],
    ],
  });
  await addBlocks(dinnerEvent.event_id, ['Priya', 'You', 'Noah'], dinner, 90);

  console.log('Created events, invitations and availability.');

  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * MINUTE);
  const notifications: Array<NewNotification & { created_at: Date }> = [
    {
      user_id: uid('You'),
      type: 'event_invite',
      icon: '@',
      is_read: false,
      created_at: new Date(Date.now() - 12 * MINUTE),
      title: 'Ava invited you to Saturday study session',
      body: 'Study Crew. Needs 4 people free for at least 2 hours. Pick the times you can make.',
      action_label: 'Pick your times',
      action_url: `/groups/${gid('Study Crew')}/events/${studySession.event_id}`,
      related_group_id: gid('Study Crew'),
      related_event_id: studySession.event_id,
    },
    {
      user_id: uid('You'),
      type: 'event_invite',
      icon: '@',
      is_read: false,
      created_at: hoursAgo(2),
      title: 'Marcus invited you to Chapter 6 discussion',
      body: 'Book Club. Needs 5 people free for at least 1 hour.',
      action_label: 'Pick your times',
      action_url: `/groups/${gid('Book Club')}/events/${bookEvent.event_id}`,
      related_group_id: gid('Book Club'),
      related_event_id: bookEvent.event_id,
    },
    {
      user_id: uid('You'),
      type: 'event_confirmed',
      icon: '✓',
      is_read: false,
      created_at: hoursAgo(5),
      title: 'Pickup game is confirmed for Friday',
      body: 'Friday Pickup Soccer. Enough people overlap from 6:30 PM to 8:00 PM.',
      action_label: 'View event',
      action_url: `/groups/${gid('Friday Pickup Soccer')}/events/${pickup.event_id}`,
      related_group_id: gid('Friday Pickup Soccer'),
      related_event_id: pickup.event_id,
    },
    {
      user_id: uid('You'),
      type: 'event_status',
      icon: '!',
      is_read: true,
      created_at: hoursAgo(26),
      title: 'Linear algebra problem set still needs 2 more people',
      body: 'Study Crew. 1 of 3 people have replied so far.',
      action_label: 'View event',
      action_url: `/groups/${gid('Study Crew')}/events/${linearAlgebra.event_id}`,
      related_group_id: gid('Study Crew'),
      related_event_id: linearAlgebra.event_id,
    },
    {
      user_id: uid('You'),
      type: 'member_joined',
      icon: '+',
      is_read: true,
      created_at: hoursAgo(72),
      title: 'Lena joined Study Crew',
      body: 'She accepted your invite.',
      action_label: 'View group',
      action_url: `/groups/${gid('Study Crew')}`,
      related_group_id: gid('Study Crew'),
      related_event_id: null,
    },
  ];
  await db.insertInto('notifications').values(notifications).execute();
  console.log(`Created ${notifications.length} notifications.`);

  console.log('Seed completed. Sign in as you@example.com / password123.');
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seed()
    .then(async () => {
      await db.destroy();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
