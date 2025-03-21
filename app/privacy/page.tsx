import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy - Descript",
  description: "Privacy policy for Descript AI Summarizer & Meeting Recorder",
}

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-gray-600 mb-8">Last Updated: 2/9/25</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
        <p className="mb-4">
          Welcome to Descript, an AI-powered transcription service. Your privacy is important to us. 
          This Privacy Policy explains how we collect, use, and protect your information. 
          By using our services, you agree to the terms outlined in this policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
        <p className="mb-4">We collect the following types of information to provide and improve our services:</p>
        <ul className="list-disc pl-6 mb-4">
          <li className="mb-2"><strong>Personal Information:</strong> Name, email address, phone number, and payment details.</li>
          <li className="mb-2"><strong>Audio & Transcription Data:</strong> Uploaded audio files, generated transcripts, and associated metadata.</li>
          <li className="mb-2"><strong>Usage Data:</strong> Information about how you interact with our app, including device type, IP address, and log data.</li>
          <li className="mb-2"><strong>Cookies and Tracking Technologies:</strong> We use cookies and similar tracking technologies to enhance user experience and analyze trends.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
        <p className="mb-4">We use your information for the following purposes:</p>
        <ul className="list-disc pl-6 mb-4">
          <li className="mb-2">To provide, personalize, and improve our transcription services.</li>
          <li className="mb-2">To process payments and facilitate transactions securely.</li>
          <li className="mb-2">To provide customer support and respond to inquiries.</li>
          <li className="mb-2">To detect and prevent fraudulent activities, security threats, and technical issues.</li>
          <li className="mb-2">To analyze usage trends and enhance user experience through analytics.</li>
          <li className="mb-2">To comply with legal obligations and enforce our Terms of Service.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Data Sharing & Third-Party Services</h2>
        <p className="mb-4">We do not sell or rent your personal information. However, we may share your data with:</p>
        <ul className="list-disc pl-6 mb-4">
          <li className="mb-2"><strong>Service Providers:</strong> Trusted third-party providers who assist with payment processing, hosting, analytics, and customer support.</li>
          <li className="mb-2"><strong>Legal Compliance:</strong> When required by law, we may disclose your information to authorities or comply with legal proceedings.</li>
          <li className="mb-2"><strong>Business Transfers:</strong> In the event of a merger, sale, or acquisition, your information may be transferred as part of the transaction.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
        <p className="mb-4">
          We implement industry-standard security measures to protect your data from unauthorized access, 
          alteration, or loss. These measures include:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li className="mb-2">Encryption of sensitive information during transmission.</li>
          <li className="mb-2">Secure storage of user data with access controls.</li>
          <li className="mb-2">Regular security audits and compliance checks.</li>
        </ul>
        <p className="mb-4">
          Despite these efforts, no security measure is 100% secure, and we cannot guarantee absolute security of your information.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Your Rights and Choices</h2>
        <p className="mb-4">You have the following rights regarding your personal data:</p>
        <ul className="list-disc pl-6 mb-4">
          <li className="mb-2"><strong>Access:</strong> Request access to the personal data we hold about you.</li>
          <li className="mb-2"><strong>Correction:</strong> Request correction of any inaccurate or incomplete data.</li>
          <li className="mb-2"><strong>Deletion:</strong> Request deletion of your personal data, subject to legal obligations.</li>
          <li className="mb-2"><strong>Opt-Out:</strong> Manage cookie preferences and opt out of marketing communications.</li>
        </ul>
        <p className="mb-4">To exercise these rights, contact us at support@descript.com.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
        <p className="mb-4">
          We retain your information for as long as necessary to fulfill the purposes outlined in this policy. 
          When no longer needed, we securely delete or anonymize your data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">8. Third-Party Links</h2>
        <p className="mb-4">
          Our service may contain links to third-party websites. We are not responsible for the privacy practices 
          of these sites and encourage you to review their policies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
        <p className="mb-4">
          We may update this policy from time to time. Any changes will be posted on this page with an updated date.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
        <p className="mb-4">
          If you have any questions about this Privacy Policy, please contact us at support@descript.com.
        </p>
      </section>
    </div>
  )
} 