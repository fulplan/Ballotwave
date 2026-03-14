import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Vote, ShieldCheck, Smartphone, TrendingUp, CheckCircle2, ArrowRight, School, Settings, Users, Globe, Hash, Zap, Building2, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "GHS 150",
    period: "/month",
    description: "Perfect for small institutions getting started",
    color: "from-slate-500 to-slate-600",
    features: [
      "2 elections per month",
      "Up to 200 voters",
      "Web voting only",
      "Basic analytics",
      "Email support",
    ],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Growth",
    price: "GHS 450",
    period: "/month",
    description: "For growing schools with active student unions",
    color: "from-primary to-emerald-400",
    features: [
      "10 elections per month",
      "Up to 1,000 voters",
      "Web + USSD voting",
      "Advanced analytics",
      "Candidate photo uploads",
      "Priority email support",
    ],
    cta: "Start Growth Plan",
    highlight: true,
  },
  {
    name: "University",
    price: "GHS 1,200",
    period: "/month",
    description: "Built for large universities and colleges",
    color: "from-violet-500 to-purple-600",
    features: [
      "Unlimited elections",
      "Unlimited voters",
      "Web + USSD + SMS",
      "Custom branding",
      "Electoral officer roles",
      "Result certificates (PDF)",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For ministries and multi-institution deployments",
    color: "from-amber-500 to-orange-600",
    features: [
      "Multi-school dashboard",
      "White-label deployment",
      "Custom integrations",
      "SLA guarantee",
      "On-site training",
      "Dedicated infrastructure",
    ],
    cta: "Talk to Us",
    highlight: false,
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: School,
    title: "Create Your School",
    desc: "Register your institution in minutes. Add your school logo, configure departments, and invite your electoral officers.",
  },
  {
    step: "02",
    icon: Settings,
    title: "Set Up Your Election",
    desc: "Define positions, add candidates, set voting dates and fees. Choose between web-only or web + USSD for all students.",
  },
  {
    step: "03",
    icon: Users,
    title: "Students Vote Securely",
    desc: "Voters get a unique receipt code after casting. Every ballot is tamper-proof and independently verifiable.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 glass-panel border-b-0 border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20">
              <Vote className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-foreground">BallotWave</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#channels" className="hover:text-foreground transition-colors">Channels</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/verify-vote">
              <Button variant="ghost" className="font-semibold text-foreground/80 hover:text-foreground hidden sm:flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Verify Vote
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="font-semibold text-foreground/80 hover:text-foreground">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="font-semibold rounded-full px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Abstract Background" 
            className="w-full h-full object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background to-background"></div>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-8 border border-primary/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Next-Gen Voting for African Schools
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-foreground mb-6 leading-tight">
              Secure Digital Elections, <br className="hidden md:block"/> Powered by <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Mobile Money.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Run transparent, fraud-free elections for your university or college. Support for web and USSD voting, real-time analytics, and instant Paystack integration.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="rounded-full px-8 text-lg h-14 w-full sm:w-auto shadow-xl shadow-primary/25 hover:-translate-y-1 transition-all duration-300">
                  Create Your School <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="rounded-full px-8 text-lg h-14 w-full sm:w-auto border-2">
                  See How It Works
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-20 grid grid-cols-3 gap-6 max-w-2xl mx-auto"
          >
            {[
              { value: "120+", label: "Schools Onboarded" },
              { value: "84K+", label: "Votes Cast" },
              { value: "99.9%", label: "Uptime SLA" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-display font-extrabold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-card relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">Everything you need to run an election</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Built specifically for the unique needs of African institutions.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Smartphone, title: "Web & USSD Voting", desc: "Voters can cast their ballots via the web portal or offline using a secure USSD code (*123#)." },
              { icon: ShieldCheck, title: "Fraud Prevention", desc: "OTP verification and strict student ID checking ensures one student, one vote." },
              { icon: TrendingUp, title: "Real-time Analytics", desc: "Watch the results come in live with beautifully detailed charts and turnout tracking." },
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-background rounded-3xl p-8 shadow-lg shadow-black/5 border border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors text-primary">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4 border border-primary/20">
              <Zap className="w-4 h-4" /> Simple Setup
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">Up and running in minutes</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">No technical expertise required. From registration to live election in three simple steps.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30"></div>
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-6 shadow-lg shadow-primary/10 relative z-10">
                  <step.icon className="w-9 h-9 text-primary" />
                  <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Voting Channels */}
      <section id="channels" className="py-24 bg-card relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-6 border border-primary/20">
                <Globe className="w-4 h-4" /> Multi-Channel Voting
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6">Vote from anywhere, on any phone</h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Not all students have smartphones or reliable internet. BallotWave supports two voting channels so every registered student can participate, regardless of their device.
              </p>
              <ul className="space-y-4">
                {[
                  "No data bundle required for USSD voting",
                  "Works on any feature phone or smartphone",
                  "Multilingual menus (English, Twi, Hausa)",
                  "Real-time sync with web results dashboard",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                    <span className="text-muted-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: Globe,
                  title: "Web Portal",
                  desc: "Full-featured browser-based voting with candidate photos, manifesto PDF viewer, and instant receipt.",
                  badge: "Smartphone",
                  color: "from-primary/20 to-emerald-400/20 border-primary/30",
                  iconColor: "text-primary",
                },
                {
                  icon: Hash,
                  title: "USSD (*123#)",
                  desc: "Works on any basic phone with a SIM. Dial the school code, enter your PIN, and vote in under 60 seconds.",
                  badge: "Any Phone",
                  color: "from-violet-500/20 to-purple-600/20 border-violet-500/30",
                  iconColor: "text-violet-500",
                },
              ].map((channel, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`col-span-1 p-6 rounded-3xl bg-gradient-to-br ${channel.color} border flex flex-col gap-4`}
                >
                  <div className={`w-12 h-12 rounded-2xl bg-background/70 flex items-center justify-center ${channel.iconColor}`}>
                    <channel.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{channel.badge}</span>
                    <h4 className="text-lg font-bold text-foreground mt-1 mb-2">{channel.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{channel.desc}</p>
                  </div>
                </motion.div>
              ))}
              <div className="col-span-2 p-6 rounded-3xl bg-secondary/30 border border-border flex items-center gap-4">
                <GraduationCap className="w-10 h-10 text-primary shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Pro & University plans</p>
                  <p className="text-sm text-muted-foreground">include both Web + USSD channels as standard. Arkesel-powered SMS OTPs included.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map / Africa section */}
      <section className="py-24 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Empowering Student Unions Across Africa</h2>
            <p className="text-secondary-foreground/70 text-lg mb-8 leading-relaxed">
              From the University of Ghana to Makerere University, BallotWave provides the scalable infrastructure needed to handle thousands of concurrent voters without crashing.
            </p>
            <ul className="space-y-4">
              {['Paystack Mobile Money Integration', 'Arkesel SMS OTPs & USSD', 'Instant Result Generation'].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="text-primary w-6 h-6" />
                  <span className="font-medium text-lg">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 relative">
            <img 
              src={`${import.meta.env.BASE_URL}images/africa-map.png`} 
              alt="Africa Map" 
              className="w-full max-w-md mx-auto opacity-80"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-background relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4 border border-primary/20">
              <Building2 className="w-4 h-4" /> Simple Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">Pay as your school grows</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">No hidden fees. Cancel anytime. All plans include a 30-day free trial.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PRICING_PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-3xl p-8 flex flex-col border transition-all duration-300 ${
                  plan.highlight
                    ? "border-primary/50 shadow-2xl shadow-primary/20 bg-card ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-primary/30 hover:shadow-lg"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-white text-xs font-bold shadow-lg whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-6`}>
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-display font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm font-medium">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    className={`w-full rounded-xl h-11 font-semibold ${plan.highlight ? "shadow-lg shadow-primary/25" : ""}`}
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">BallotWave</span>
          </div>
          <p className="mb-4">The trusted election platform for African institutions.</p>
          <p>© {new Date().getFullYear()} BallotWave Africa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
