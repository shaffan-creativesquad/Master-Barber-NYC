import { getMemberships } from '@/lib/site-data'
import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  firstName?: string
  planName?: string
  amount?: string
  interval?: string
  nextBillingDate?: string
  memberCode?: string
  cardLast4?: string
  accountUrl?: string
}

const Email = ({
  firstName,
  planName = 'Membership',
  amount = '',
  interval = 'monthly',
  nextBillingDate = '',
  memberCode = '',
  cardLast4 = '',
  accountUrl = 'https://masterbarbernyc.com/account',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {planName} membership at Master Barber NYC is active.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MASTER BARBER NYC</Text>
        <Heading style={heading}>Your membership is active</Heading>
        <Text style={text}>
          {firstName ? `Hi ${firstName},` : 'Hi there,'} thanks for joining. Here are the details of
          your order.
        </Text>

        <Section style={card}>
          <Row style={row}>
            <Column style={label}>Plan</Column>
            <Column style={value}>{planName}</Column>
          </Row>
          {amount ? (
            <Row style={row}>
              <Column style={label}>Amount paid today</Column>
              <Column style={value}>{amount}</Column>
            </Row>
          ) : null}
          <Row style={row}>
            <Column style={label}>Billing</Column>
            <Column style={value}>{interval === 'annual' || interval === 'year' ? 'Yearly' : 'Monthly'}</Column>
          </Row>
          {nextBillingDate ? (
            <Row style={row}>
              <Column style={label}>Next billing</Column>
              <Column style={value}>{nextBillingDate}</Column>
            </Row>
          ) : null}
          {cardLast4 ? (
            <Row style={row}>
              <Column style={label}>Card on file</Column>
              <Column style={value}>•••• {cardLast4}</Column>
            </Row>
          ) : null}
          {memberCode ? (
            <Row style={row}>
              <Column style={label}>Member code</Column>
              <Column style={value}>{memberCode}</Column>
            </Row>
          ) : null}
        </Section>

        <Section style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <Button style={button} href={accountUrl}>
            View My Account
          </Button>
        </Section>
        <Text style={muted}>
          Sign in with this email address — no password needed. We&apos;ll email you a secure
          sign-in link.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Questions about your membership? Just reply to this email and our team will help.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Your ${data['planName'] ?? 'membership'} at Master Barber NYC is confirmed`,
  displayName: 'Membership order confirmation',
  get previewData() {
    return {
    firstName: 'Cody',
    planName: 'Silver Unlimited',
    amount: `${getMemberships().find((m) => m.id === 'silver-monthly')?.price ?? ''}`,
    interval: 'monthly',
    nextBillingDate: 'September 10, 2026',
    memberCode: 'MB-1042',
    cardLast4: '1111',
    accountUrl: 'https://masterbarbernyc.com/account',
    }
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Helvetica, Arial, sans-serif',
  color: '#1a1a1a',
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = {
  fontSize: '12px',
  letterSpacing: '3px',
  color: '#8a6d1f',
  margin: '0 0 12px',
  fontWeight: 700,
}
const heading = { fontSize: '24px', margin: '0 0 12px', color: '#111111' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#333333', margin: '0 0 20px' }
const card = {
  border: '1px solid #e8e2d3',
  borderRadius: '14px',
  padding: '18px 20px',
  backgroundColor: '#fdfaf3',
  margin: '0 0 24px',
}
const row = { padding: '6px 0' }
const label = { fontSize: '13px', color: '#6b6b6b', width: '52%' }
const value = { fontSize: '14px', color: '#111111', fontWeight: 600, textAlign: 'right' as const }
const button = {
  backgroundColor: '#c9a84c',
  color: '#1a1a1a',
  fontWeight: 700,
  fontSize: '15px',
  padding: '13px 28px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
}
const muted = {
  fontSize: '13px',
  color: '#6b6b6b',
  textAlign: 'center' as const,
  margin: '14px 0 0',
}
const hr = { borderColor: '#eeeeee', margin: '26px 0 16px' }
const footer = { fontSize: '13px', color: '#6b6b6b', margin: 0 }
