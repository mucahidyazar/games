import type { ReactElement } from 'react'
import { site } from '@/app/site'
import { siteConfig } from '@/lib/site'

const GOOGLE_PARTNER_SITES_URL = 'https://policies.google.com/technologies/partner-sites'
const GOOGLE_ADS_SETTINGS_URL = 'https://adssettings.google.com'

interface PrivacyContentProps {
  /** Defaults to the configured contact address. */
  readonly contactEmail?: string | null
}

/** Privacy policy copy rendered inside the shared prose surface. */
export function PrivacyContent({ contactEmail = siteConfig.contactEmail }: PrivacyContentProps): ReactElement {
  return (
    <>
      <p>
        <strong>Effective September 30, 2026</strong>
      </p>

      <h3>Overview</h3>
      <p>
        {site.name} is made for playing, not for collecting data. You can play without an account. An account is
        optional and only needed to put your scores on the leaderboards, keep records and earn badges.
      </p>

      <h3>If you create an account</h3>
      <p>We store what the leaderboards need, and nothing else:</p>
      <ul>
        <li>
          <strong>Your sign-in details</strong>: your email address and, if you sign in with Google, the name and
          profile picture Google shares with us. We never see your Google password.
        </li>
        <li>
          <strong>Your nickname</strong>, which is shown publicly on the leaderboards.
        </li>
        <li>
          <strong>Your ranked runs</strong>: mode, score, level, and the walls you built and when. We replay these
          moves on our server to check each score before it counts.
        </li>
        <li>
          <strong>Your records, badges and Daily Challenge streak.</strong>
        </li>
        <li>
          <strong>A session cookie</strong> that keeps you signed in. It is a strictly necessary, HTTP-only cookie and
          is not used for advertising.
        </li>
      </ul>
      <p>
        If you sign in by email, a one-time code is sent to you through our email provider, Resend. Your nickname,
        scores and records are public on the leaderboards; your email address never is.
      </p>
      <p>
        You can change your nickname or delete your account at any time from your profile page. Deleting it removes
        your profile, runs, records and badges from our database.
      </p>

      <h3>Data stored on your device</h3>
      <p>The game keeps a few things in your browser’s local storage so it can remember them between visits:</p>
      <ul>
        <li>
          <strong>Settings</strong>: your sound preference, the last mode you played, your Custom setup and the name
          you use for scores saved on this device.
        </li>
        <li>
          <strong>Guest high scores</strong>: your best games played without an account.
        </li>
        <li>
          <strong>Unfinished practice game</strong>: the level and score to continue from.
        </li>
        <li><strong>Your analytics consent choice.</strong></li>
      </ul>
      <p>
        This data stays on your device and is never sent to our servers. To delete guest scores, use “Clear device
        scores” on the leaderboards page. To remove everything, clear this site’s data in your browser.
      </p>

      <h3>Optional analytics</h3>
      <p>
        Google Analytics, loaded through Google Tag Manager, stays off until you allow analytics. Our page-view
        events contain the page path and origin, without query strings, fragments or the referring URL. We do not
        send form values, email addresses, account details or game replay data to analytics. Google also receives
        technical request information and may use analytics cookies and device identifiers; this is not anonymous
        processing. You can refuse or withdraw analytics through “Privacy settings” in the footer.
      </p>

      <h3>Advertising</h3>
      <p>
        Ads help keep {site.name} free. When ads are enabled, they are provided by Google AdSense. Google and its
        partners may use cookies or similar identifiers to show ads, to measure how they perform and, depending on your
        choices, to personalise them based on your visits to this and other websites.
      </p>
      <p>
        Learn{' '}
        <a href={GOOGLE_PARTNER_SITES_URL} target="_blank" rel="noopener noreferrer">
          how Google uses information from sites that use its services
        </a>
        , or manage personalised ads in{' '}
        <a href={GOOGLE_ADS_SETTINGS_URL} target="_blank" rel="noopener noreferrer">
          Google Ads Settings
        </a>
        .
      </p>
      <p>
        Advertising is disabled until the AdSense account, site approval and consent management are configured.
        Before enabling ads for visitors from the European Economic Area, the United Kingdom or Switzerland, we must
        configure a Google-certified consent management platform. Our analytics preference panel is not that platform.
      </p>

      <h3>Server logs and security</h3>
      <p>
        Like most websites, our servers may log standard technical data, such as your IP address, browser user agent and
        the time of each request. We use it only to keep the site secure and reliable, for example to limit sign-in
        attempts.
      </p>

      <h3>Children</h3>
      <p>
        {site.name} is a general-audience game. You can play without giving any personal information, and we
        don’t knowingly collect personal information from children under 13. If you believe a child has created an
        account, contact us and we’ll delete it.
      </p>

      <h3>Changes</h3>
      <p>
        We may update this policy as {site.name} grows, for example when our mobile apps launch. When we do,
        we’ll change the effective date at the top.
      </p>

      <h3>Contact</h3>
      {contactEmail !== null ? (
        <p>
          Questions about this policy? Email us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      ) : (
        <p>Questions about this policy? We’ll add a contact address to this page soon.</p>
      )}
    </>
  )
}
