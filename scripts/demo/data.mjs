// What the demo seed creates (see seed.mjs). Everything here is made up:
// names, phone numbers, documents and video links. Phone numbers are in the
// fake +2547000000xx range: 01–29 organisers, 30–79 beneficiaries and guardians.

// Accounts --------------------------------------------------------------------
// Emails are never real. Organisers and supporters use DEMO_PASSWORD from
// .env.local if it's set; the admin always gets a random password nobody knows,
// because an admin can see real users' private data.

export const ACCOUNTS = {
  org1: { email: "demo.organiser01@example.com", name: "Njeri Mwangi", phone: "+254700000001" },
  org2: { email: "demo.organiser02@example.com", name: "Joseph Mutua", phone: "+254700000002" },
  org3: { email: "demo.organiser03@example.com", name: "Samuel Kiptoo", phone: "+254700000003" },
  org4: { email: "demo.organiser04@example.com", name: "Kevin Odhiambo", phone: "+254700000004" },
  sup1: { email: "demo.supporter01@example.com", name: "Brenda Atieno" },
  sup2: { email: "demo.supporter02@example.com", name: "Otieno Okoth" },
  sup3: { email: "demo.supporter03@example.com", name: "Wanjiru Kamau" },
  admin: { email: "demo.admin@example.com", name: "Demo Admin", admin: true },
};

// Harambees -------------------------------------------------------------------
// In creation order. New organisers can't ask for more than KES 100,000 until
// they have a completed or documents-checked harambee (organiser_is_trusted in
// supabase/organiser_verification.sql), and nobody runs more than 2 at once, so:
// - org2 and org4 each have an earlier, completed harambee (the two "extra" ones)
// - org1 is trusted once Mama Wanjiku's documents are checked
// - org3 is trusted once Brian's fee structure is checked
//
// Days are "days ago". pct is the share of the goal raised; the seed makes
// donations adding up to exactly that. Photos are file names inside
// demo-images/<key>/ and are skipped (with a warning) if missing.

export const HARAMBEES = [
  {
    key: "mwangaza-desks",
    extra: true,
    org: "org2",
    title: "New desks for Mwangaza Primary School",
    category: "Education",
    location: "Machakos",
    goal: 60_000,
    pct: 1,
    beneficiary: "Mwangaza Primary School",
    story:
      "Our Standard 4 pupils were sharing one desk between three children, and some sat on the floor.\n\n" +
      "With KES 60,000 the local fundi can make 30 strong desks from cypress. Every child will have a place to write. Asante for standing with our school.",
    createdDaysAgo: 42,
    completeDaysAgo: 26,
    donors: "general",
    cover: "cover.jpg",
    updates: [
      {
        type: "general",
        daysAgo: 25,
        afterComplete: true,
        body: "All 30 desks are in the classroom! Thank you to every parent, old student and friend who gave. The pupils sang for you this morning.",
      },
    ],
  },
  {
    key: "kondele-choir",
    extra: true,
    org: "org4",
    title: "Take Kondele Youth Choir to the music festival",
    category: "Talent",
    location: "Kisumu",
    goal: 50_000,
    pct: 1,
    beneficiary: "Kondele Youth Choir",
    story:
      "Our 24 singers qualified for the regional music festival in Nakuru. We need bus fare, meals and matching shirts for two days.\n\n" +
      "These young people practise every evening after school. Help us get them on that stage.",
    createdDaysAgo: 35,
    completeDaysAgo: 24,
    donors: "general",
    cover: "cover.jpg",
    updates: [
      {
        type: "general",
        daysAgo: 23,
        afterComplete: true,
        body: "We came second in our class at the festival! Thank you for the bus, the meals and the shirts. Video of the performance coming soon.",
      },
    ],
  },
  {
    key: "mama-wanjiku",
    org: "org1",
    title: "Help Mama Wanjiku restock and grow her vegetable stall",
    category: "Business & Empowerment",
    location: "Githurai 45, Nairobi",
    goal: 70_000,
    pct: 0.8,
    beneficiary: "Mama Wanjiku",
    story:
      "Mama Wanjiku has sold sukuma, tomatoes and onions at the Githurai 45 market for twelve years. When her video telling customers \"hakuna kulala njaa hapa\" went viral, people asked how they could help.\n\n" +
      "She lost most of her stock in the April floods. KES 70,000 will restock the stall, buy a proper shade and crates, and let her start supplying two nearby schools.\n\n" +
      "I'm part of her chama, and we will post every step here.",
    createdDaysAgo: 18,
    viral: {
      url: "https://www.facebook.com/watch/?v=100000000000001",
      name: "Lucy Wanjiku Njoroge",
      phone: "+254700000032",
      confirmedDaysAgo: 17,
    },
    docs: { fileName: "business-plan-demo.pdf", title: "Business plan", checkedDaysAgo: 17 },
    donors: "general",
    cover: "cover.jpg",
    updates: [
      {
        type: "gift",
        daysAgo: 10,
        giftItem: "Weighing scale",
        giftGiver: "Kamau Hardware",
        giftValue: 4_500,
      },
      {
        type: "progress",
        daysAgo: 7,
        photo: "progress-stall.jpg",
        body: "The new shade and crates are up, and the stall is fully stocked again. Mama Wanjiku delivered her first order to a school on Monday.",
      },
    ],
  },
  {
    key: "kibera-water-tank",
    org: "org1",
    title: "Clean water tank for Kibera youth group",
    category: "Community",
    location: "Nairobi",
    goal: 180_000,
    pct: 0.92,
    beneficiary: "Amani Youth Group",
    story:
      "Amani Youth Group runs a car wash and a clean-up crew in Kibera. Water is our biggest cost: we buy it by the jerrican every day.\n\n" +
      "A 10,000-litre tank with gutters and a stand will give 60 households cheaper, clean water, and cut the car wash's costs in half. Every KES 50 counts.",
    createdDaysAgo: 21,
    donors: "small",
    cover: "cover.jpg",
    updates: [
      {
        type: "progress",
        daysAgo: 6,
        body: "The concrete stand is built and the gutters are fitted. Once we reach the goal, the tank goes up.",
      },
    ],
  },
  {
    key: "mwangaza-classroom",
    org: "org2",
    title: "Build a new classroom for Mwangaza Primary School",
    category: "Education",
    location: "Machakos",
    goal: 600_000,
    pct: 0.4,
    beneficiary: "Mwangaza Primary School",
    story:
      "Thanks to you, our pupils have desks. Now they need a room: Grade 5 has been learning under a tree since January, and lessons stop whenever it rains.\n\n" +
      "The PTA has a contractor's quotation of KES 600,000 for a full classroom with windows, a floor and a blackboard. Parents are giving labour, and we are raising the rest here.",
    createdDaysAgo: 21,
    approveDaysAgo: 20,
    docs: { fileName: "contractor-quotation-demo.pdf", title: "Contractor's quotation", checkedDaysAgo: 19 },
    donors: "large",
    cover: "cover.jpg",
    updates: [
      {
        type: "progress",
        daysAgo: 14,
        photo: "progress-foundation.jpg",
        body: "The foundation is dug and poured. Parents came every Saturday to help the fundis.",
      },
      {
        type: "gift",
        daysAgo: 11,
        photo: "gift-cement.jpg",
        giftItem: "50 bags of cement",
        giftGiver: "Mavoko Builders Supplies",
        giftValue: 40_000,
      },
      {
        type: "progress",
        daysAgo: 5,
        photo: "progress-walls.jpg",
        body: "The walls are up to window level. Next: the roof, once we raise the rest.",
      },
    ],
  },
  {
    key: "mama-akinyi",
    org: "org4",
    title: "Help Mama Akinyi recover after her surgery",
    category: "Medical",
    location: "Kisumu",
    goal: 250_000,
    pct: 0.65,
    beneficiary: "Mama Akinyi",
    story:
      "My mother, Mama Akinyi, had emergency abdominal surgery in Kisumu three weeks ago. The operation went well, but the hospital bill and the medicine for her recovery are more than our family can carry.\n\n" +
      "Mama has fed half of our estate at one time or another. Now we are asking you to stand with her. The hospital bill is uploaded and checked.",
    createdDaysAgo: 20,
    docs: { fileName: "hospital-bill-demo.pdf", title: "Hospital bill", checkedDaysAgo: 18 },
    donors: "general",
    anonymousShare: 0.25,
    cover: "cover.jpg",
    updates: [
      {
        type: "recovery",
        daysAgo: 16,
        recoveryStatus: "in_hospital",
        body: "Mama is out of theatre and resting in the ward. The doctors are happy with how the surgery went. Thank you for every prayer and every shilling.",
      },
      {
        type: "gift",
        daysAgo: 12,
        giftItem: "Mattress and bedding",
        giftGiver: "Wanjiru’s Chama",
        giftValue: 12_000,
      },
      {
        type: "gift",
        daysAgo: 9,
        giftItem: "A month of food",
        giftGiver: null, // anonymous
        giftValue: 8_000,
      },
      {
        type: "recovery",
        daysAgo: 4,
        recoveryStatus: "back_home",
        photo: "back-home.jpg",
        body: "Mama is back home! She is walking a little every day and already asking about her customers.",
      },
    ],
  },
  {
    key: "faith-achieng",
    org: "org4",
    title: "Help Faith Achieng record her first song",
    category: "Talent",
    location: "Kisumu",
    goal: 90_000,
    pct: 0.55,
    beneficiary: "Faith Achieng",
    story:
      "Faith sang \"Nyar Kisumu\" at a friend's birthday and the clip went viral on TikTok. Thousands asked where they can hear the full song. The truth is, she has never been in a studio.\n\n" +
      "KES 90,000 covers studio time, a producer, mixing and a simple music video. I manage the Kondele Youth Choir, where Faith started, and I'll share every step.",
    createdDaysAgo: 12,
    viral: {
      url: "https://www.tiktok.com/@faithachieng.demo/video/7400000000000000001",
      name: "Faith Achieng",
      phone: "+254700000031",
      confirmedDaysAgo: 11,
    },
    donors: "general",
    cover: "cover.jpg",
    challenges: [
      // Live: the host has given, about 3 hours left.
      { host: "sup1", type: "mgeni_rasmi", durationMinutes: 24 * 60, hoursLeft: 3, hostGift: 2_000, total: 9_500 },
      // Live KSh 100 challenge.
      { host: "sup2", type: "ksh_100", durationMinutes: 72 * 60, hoursLeft: 42, total: 6_000 },
    ],
    updates: [
      {
        type: "gift",
        daysAgo: 6,
        photo: "gift-microphone.jpg",
        giftItem: "Microphone and headphones",
        giftGiver: "Lakeside Music Shop",
        giftValue: 12_000,
      },
      {
        type: "progress",
        daysAgo: 3,
        photo: "progress-studio.jpg",
        body: "Studio booked! Faith records the vocals next Saturday with producer Okello. She has been rehearsing every night.",
      },
    ],
  },
  {
    key: "brian-school-fees",
    org: "org3",
    title: "School fees for Brian",
    category: "School Fees",
    location: "Uasin Gishu",
    goal: 45_000,
    pct: 0.3,
    beneficiary: "Brian",
    // No school or village named: Brian is under 18.
    story:
      "Brian is 15 and loves maths and football. He passed his exams well, but his mother can't raise this year's fees on her own since his father passed away.\n\n" +
      "I'm his uncle. KES 45,000 covers fees, uniform and books for the year. His mother has confirmed this harambee and the fee structure has been checked.",
    createdDaysAgo: 9,
    minor: { name: "Rose Chebet", relationship: "Mother", phone: "+254700000033", confirmedDaysAgo: 8 },
    // Not in the brief: checked so org3 can run the bigger harambees below.
    docs: { fileName: "fee-structure-demo.pdf", title: "Fee structure", checkedDaysAgo: 8 },
    approveDaysAgo: 7,
    donors: "general",
    cover: "cover.jpg",
    updates: [],
  },
  {
    key: "mzee-kiprono",
    org: "org3",
    title: "Send-off for Mzee Kiprono",
    category: "Funeral",
    location: "Eldoret",
    goal: 200_000,
    pct: 1.05,
    beneficiary: "The Kiprono family",
    story:
      "Our father, Mzee Joseph Kiprono, rested peacefully at the age of 84. He was a teacher for 35 years, and half of Eldoret learnt to read in his classroom.\n\n" +
      "We are raising funds for a dignified send-off: the hearse, the tents, food for the mourners and the burial. Thank you for walking with our family.",
    createdDaysAgo: 14,
    completeDaysAgo: 3,
    donors: "general",
    cover: "cover.jpg",
    updates: [
      {
        type: "progress",
        daysAgo: 10,
        body: "The burial will be on Saturday at the family home. The tents, chairs and catering are booked. Mourners are welcome from 9 a.m.",
      },
      {
        type: "general",
        daysAgo: 2,
        afterComplete: true,
        body: "We laid Mzee to rest on Saturday surrounded by hundreds of friends and former pupils. You helped us pass our goal, and the extra goes to his widow's upkeep. Asanteni sana.",
      },
    ],
  },
  {
    key: "mary-john-wedding",
    org: "org3",
    title: "Mary & John’s wedding harambee",
    category: "Wedding",
    location: "Nakuru",
    goal: 150_000,
    pct: 0.7,
    beneficiary: "Mary and John",
    story:
      "My nephew John and his fiancée Mary are getting married in December! Their families are coming together for a church wedding and a reception for 300 guests.\n\n" +
      "Help us with the venue, the tents, catering and the cake. Sindikiza the couple and come dance with us.",
    createdDaysAgo: 19,
    donors: "general",
    cover: "cover.jpg",
    challenges: [
      // Ended about 9 days ago, with its final total.
      { host: "sup3", type: "mgeni_rasmi", durationMinutes: 24 * 60, endedDaysAgo: 9, hostGift: 3_000, total: 18_000 },
      // Live KSh 50 challenge.
      { host: "sup1", type: "ksh_50", durationMinutes: 48 * 60, hoursLeft: 28, total: 3_500 },
    ],
    updates: [
      {
        type: "progress",
        daysAgo: 13,
        body: "The church and the reception venue are booked for 14 December. Mary has chosen her dress!",
      },
      {
        type: "progress",
        daysAgo: 4,
        body: "Tents and catering paid in full. Next on the list: the cake and the decor.",
      },
    ],
  },
];

// Donors ----------------------------------------------------------------------

export const FIRST_NAMES = [
  "Wanjiku", "Kamau", "Achieng", "Otieno", "Njeri", "Mwangi", "Akinyi", "Odhiambo", "Chebet", "Kiprop",
  "Wambui", "Kiprono", "Nyambura", "Ochieng", "Muthoni", "Kibet", "Atieno", "Mutua", "Wairimu", "Omondi",
  "Jepkosgei", "Njoroge", "Adhiambo", "Karanja", "Mumbua", "Wekesa", "Nafula", "Barasa", "Halima", "Juma",
  "Grace", "Peter", "Mary", "John", "Faith", "James", "Esther", "David", "Mercy", "Brian",
  "Lucy", "Samuel", "Ann", "Daniel", "Joyce", "Kevin", "Caroline", "Dennis", "Purity", "Collins",
];

export const LAST_NAMES = [
  "Kamau", "Otieno", "Wanjiru", "Odhiambo", "Mwangi", "Achieng", "Kiprotich", "Njoroge", "Mutua", "Chebet",
  "Omondi", "Wambui", "Kariuki", "Onyango", "Kiplagat", "Muthoni", "Wekesa", "Nyaga", "Owino", "Korir",
  "Mohamed", "Ali", "Barasa", "Ndungu", "Mbugua", "Kilonzo", "Mueni", "Rotich", "Okoth", "Wafula",
];

export const MESSAGES = [
  "Pole sana, get well soon.",
  "Mungu akubariki.",
  "Tuko pamoja!",
  "Sisi kwa sisi 🙏",
  "Small but from the heart.",
  "From the whole chama.",
  "Keep going!",
  "Proud of you.",
  "Hongera!",
  "Asante for organising this.",
  "Wishing you all the best.",
  "From your friends in Nairobi.",
];

// Amounts people pick, KES 50 to 5,000. "small" is for harambees with many
// small donors, "large" for big goals.
export const AMOUNTS = {
  general: [50, 100, 100, 200, 200, 250, 300, 500, 500, 500, 1_000, 1_000, 1_000, 1_500, 2_000, 2_000, 2_500, 3_000, 5_000],
  small: [50, 50, 100, 100, 100, 150, 200, 200, 300, 500, 500, 500, 1_000, 1_000],
  large: [200, 500, 500, 1_000, 1_000, 2_000, 2_000, 2_500, 3_000, 3_000, 5_000, 5_000],
};
