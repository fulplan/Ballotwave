import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Vote, ShieldCheck, Smartphone, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

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
          <div className="flex items-center gap-4">
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
              <Button size="lg" variant="outline" className="rounded-full px-8 text-lg h-14 w-full sm:w-auto border-2">
                View Live Demo
              </Button>
            </div>
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

      {/* Map Section */}
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

      {/* Footer */}
      <footer className="bg-background py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Vote className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-xl text-foreground">BallotWave</span>
          </div>
          <p>© {new Date().getFullYear()} BallotWave Africa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
