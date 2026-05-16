// ============================================================
// NEUROTEK AI — Legal Pages (RGPD / CGU / CGV)
// Privacy Policy · Terms of Use · Terms of Sale
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, FileText, ShoppingCart, ChevronRight } from 'lucide-react';

type LegalTab = 'privacy' | 'terms' | 'sales';
const TABS = [
  { id: 'privacy' as LegalTab, label: 'Privacy Policy', icon: Shield },
  { id: 'terms' as LegalTab, label: 'Terms of Use', icon: FileText },
  { id: 'sales' as LegalTab, label: 'Terms of Sale', icon: ShoppingCart },
];

function SH({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-white mt-8 mb-2 first:mt-0 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-purple-500 flex-shrink-0" />{children}</h3>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-gray-300 mt-5 mb-1.5">{children}</h4>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 leading-relaxed mb-3">{children}</p>;
}
function UL({ items }: { items: string[] }) {
  return (
    <ul className="mb-3 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
          <ChevronRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PrivacyContent() {
  return (
    <>
      <P>NEUROTEK AI SAS is committed to protecting your personal data under GDPR/RGPD 2016/679 and French loi Informatique et Libertés.</P>
      <SH>1. Data We Collect</SH>
      <Sub>Account data</Sub>
      <P>Email address, display name, hashed password, subscription tier, and authentication tokens. Passwords are never stored in plaintext.</P>
      <Sub>Usage data</Sub>
      <P>AI request counts, chosen genres, skill levels in the AI Coach, project metadata, and feature interactions. Used exclusively for quota enforcement, analytics, and service improvement.</P>
      <Sub>Payment data</Sub>
      <P>Payments are processed by Stripe, Inc. We do not store card numbers. We receive only a Stripe customer ID, subscription status, and anonymised billing metadata.</P>
      <Sub>Technical data</Sub>
      <P>IP addresses (fraud prevention and rate limiting), browser/OS type, device fingerprint hash for session security. Logs retained for 90 days then automatically deleted.</P>
      <Sub>Cookies &amp; local storage</Sub>
      <P>Essential cookies for session management and authentication tokens in localStorage. No third-party advertising or tracking cookies.</P>
      <SH>2. Why We Use Your Data</SH>
      <UL items={[
        'Account management (legal basis: contract performance)',
        'Enforce AI request quotas and subscription limits (contract)',
        'Process payments via Stripe (contract)',
        'Send transactional emails — password reset, billing receipts (contract)',
        'Improve AI models on anonymised, aggregated data (legitimate interest)',
        'Comply with legal obligations: tax, fraud prevention, law enforcement',
      ]} />
      <SH>3. Data Retention</SH>
      <P>Account data retained for subscription duration plus 3 years. AI Coach chat history purged after 90 days. Anonymised analytics may be retained indefinitely.</P>
      <SH>4. Your Rights (RGPD Art. 15–22)</SH>
      <P>Contact <a href="mailto:privacy@mixpiloteai.com" className="text-purple-400 underline">privacy@mixpiloteai.com</a> to exercise:</P>
      <UL items={[
        'Right of access — obtain a copy of all personal data we hold',
        'Right to rectification — correct inaccurate or incomplete data',
        'Right to erasure — request deletion of your account and data',
        'Right to data portability — receive your data in JSON/CSV format',
        'Right to object — object to processing based on legitimate interest',
        'Right to lodge a complaint with the CNIL at www.cnil.fr',
      ]} />
      <SH>5. Data Transfers</SH>
      <P>Data processed in the EEA. Sub-processors outside the EEA (e.g. Anthropic, Inc.) are covered by Standard Contractual Clauses (SCCs).</P>
      <SH>6. DPO Contact</SH>
      <P>DPO: <a href="mailto:dpo@mixpiloteai.com" className="text-purple-400 underline">dpo@mixpiloteai.com</a>. Response within 30 days as required by RGPD.</P>
      <SH>7. Changes</SH>
      <P>We notify you by email at least 30 days before any material change. Continued use constitutes acceptance.</P>
    </>
  );
}

function TermsOfUseContent() {
  return (
    <>
      <P>These Terms of Use govern your access to and use of the NEUROTEK AI platform. By creating an account you agree to these terms.</P>
      <SH>1. Service Description</SH>
      <P>NEUROTEK AI provides AI-assisted music production tools for tekno and underground electronic music genres: AI chat, template generation, mix analysis, AI Coach, pack management, and cloud project storage depending on plan.</P>
      <SH>2. Eligibility &amp; Account</SH>
      <P>You must be at least 18 years old. You are responsible for maintaining credential confidentiality. Notify <a href="mailto:security@mixpiloteai.com" className="text-purple-400 underline">security@mixpiloteai.com</a> immediately of any suspected unauthorised access.</P>
      <SH>3. User Obligations</SH>
      <UL items={[
        'Provide accurate registration information and keep it up to date',
        'Use the Service only for lawful music production purposes',
        'Respect the AI request quotas associated with your subscription plan',
        'Not share account credentials or subscription with third parties',
        'Comply with applicable laws, including copyright and export control',
      ]} />
      <SH>4. Prohibited Uses</SH>
      <UL items={[
        'Reverse engineering, decompiling, or disassembling any part of the Service',
        'Cracking or attempting to bypass access controls, quota systems, or authentication',
        'Automated API scraping, bulk extraction of AI responses, or reselling AI outputs',
        'Uploading content that infringes third-party intellectual property rights',
        'Introducing malware or code that could disrupt or damage our systems',
        'Accessing another user’s account or impersonating any person or entity',
      ]} />
      <SH>5. Intellectual Property</SH>
      <Sub>Our IP</Sub>
      <P>NEUROTEK AI branding, software, and AI models are the exclusive property of NEUROTEK AI SAS, protected by French and EU law.</P>
      <Sub>Your content</Sub>
      <P>You retain full ownership of your music projects and audio files. By uploading packs to the marketplace you grant NEUROTEK AI a non-exclusive, worldwide, royalty-free licence to host and distribute that content within the Service.</P>
      <Sub>AI-generated content</Sub>
      <P>Templates and suggestions are for personal creative use. We make no warranty regarding originality or non-infringement.</P>
      <SH>6. Limitation of Liability</SH>
      <P>To the maximum extent permitted by law, NEUROTEK AI shall not be liable for indirect or consequential damages. Total aggregate liability shall not exceed the amount you paid us in the preceding 12 months.</P>
      <SH>7. Governing Law</SH>
      <P>These terms are governed by French law. Disputes not resolved amicably within 30 days shall be submitted to the Paris Commercial Court.</P>
    </>
  );
}

function TermsOfSaleContent() {
  return (
    <>
      <P>These Terms of Sale govern the purchase of subscriptions and paid digital products from NEUROTEK AI SAS.</P>
      <SH>1. Subscription Plans</SH>
      <UL items={[
        'Free — €0/month, limited features',
        'Learning — €7/month or €59/year (≈ €4.92/month)',
        'Creator — €12/month or €99/year (≈ €8.25/month)',
        'Studio — €29/month or €249/year (≈ €20.75/month)',
      ]} />
      <P>All prices in EUR, exclusive of VAT unless stated. VAT rate determined by your country of residence per EU VAT Directive 2006/112/EC.</P>
      <SH>2. Payment</SH>
      <P>All payments processed by Stripe, Inc. (PCI-DSS Level 1). We accept Visa, Mastercard, American Express, and SEPA Direct Debit where available. Subscriptions renew automatically; failed payments are retried up to 3 times over 7 days before account suspension.</P>
      <SH>3. Cancellation</SH>
      <P>Subscriptions renew automatically unless cancelled before the renewal date. Cancellation takes effect at the end of the current billing period. Downgrading takes effect at the next renewal with no partial refund except as required by law.</P>
      <SH>4. Right of Withdrawal (EU 14-Day Cooling-Off)</SH>
      <P>Per EU Directive 2011/83/EU, you may withdraw within 14 calendar days of purchase for a full refund. If you have used the Service during this period, a pro-rata deduction applies based on days used.</P>
      <P>To withdraw, contact <a href="mailto:billing@mixpiloteai.com" className="text-purple-400 underline">billing@mixpiloteai.com</a> with subject “Withdrawal — [order ID]”. Refunds processed within 14 days via original payment method.</P>
      <SH>5. Refunds Outside Cooling-Off</SH>
      <P>Beyond 14 days, refunds are at our discretion for exceptional circumstances (e.g. documented technical failure &gt;72 consecutive hours). Contact billing@mixpiloteai.com.</P>
      <SH>6. VAT &amp; Tax</SH>
      <P>NEUROTEK AI SAS is registered for VAT in France. B2B EU customers with a valid VAT number: reverse-charge applies. VAT receipts available in your billing portal.</P>
      <SH>7. Digital Products</SH>
      <P>Individual pack purchases are non-refundable once the download has been initiated per Art. 16(m) of Directive 2011/83/EU.</P>
      <SH>8. Governing Law</SH>
      <P>Governed by French law. Consumer disputes: EU ODR platform at <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">ec.europa.eu/consumers/odr</a>. B2B: Paris Commercial Court.</P>
      <SH>9. Contact</SH>
      <P>NEUROTEK AI SAS · Paris, France · <a href="mailto:billing@mixpiloteai.com" className="text-purple-400 underline">billing@mixpiloteai.com</a></P>
    </>
  );
}

export default function LegalPages() {
  const [activeTab, setActiveTab] = useState<LegalTab>('privacy');
  return (
    <div className="bg-[#0a0a0f] min-h-full text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Legal Information</h1>
          <p className="text-gray-400 text-sm">NEUROTEK AI SAS · Effective from May 2026</p>
        </div>
        <div className="flex gap-1 bg-gray-800/60 border border-gray-700/60 rounded-xl p-1 mb-8">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === id ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
            className="bg-gray-900/50 border border-gray-800/60 rounded-2xl px-7 py-8"
          >
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-gray-800">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
            {activeTab === 'privacy' && <PrivacyContent />}
            {activeTab === 'terms' && <TermsOfUseContent />}
            {activeTab === 'sales' && <TermsOfSaleContent />}
          </motion.div>
        </AnimatePresence>
        <div className="mt-8 text-center">
          <p className="text-gray-600 text-xs">Last updated: May 2026 · NEUROTEK AI SAS · All rights reserved</p>
          <p className="text-gray-700 text-xs mt-1">Legal enquiries: <a href="mailto:legal@mixpiloteai.com" className="text-purple-500 hover:text-purple-400 underline">legal@mixpiloteai.com</a></p>
        </div>
      </div>
    </div>
  );
}
