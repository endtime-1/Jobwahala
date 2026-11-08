import { describe, expect, it } from 'vitest';
import { displayNameOf, participantSelect, toParticipant } from '../../utils/participant';

describe('how a person is named in a conversation', () => {
  it('an employer is its company name, not the placeholder from sign-up', () => {
    expect(displayNameOf({ id: 'u1', email: 'hr@acme.example', employerProfile: { companyName: 'Acme Ltd' } })).toBe('Acme Ltd');
    expect(displayNameOf({ id: 'u1', email: 'hr@acme.example', employerProfile: { companyName: 'New Company' } })).toBeNull();
  });

  it('a job seeker or freelancer is their own name, tidied up', () => {
    expect(displayNameOf({ id: 'u2', email: 'a@b.example', jobSeekerProfile: { firstName: ' Ama ', lastName: 'Mensah' } })).toBe('Ama Mensah');
    expect(displayNameOf({ id: 'u3', email: 'k@b.example', freelancerProfile: { firstName: 'Kwame', lastName: null } })).toBe('Kwame');
  });

  it('has no name when nothing is filled in, so the page falls back to the email handle', () => {
    expect(displayNameOf({ id: 'u4', email: 'yaw@x.example', jobSeekerProfile: { firstName: '', lastName: null } })).toBeNull();
    expect(displayNameOf({ id: 'u5', email: 'z@x.example' })).toBeNull();
  });

  it('what the other person gets is an id, an email, a role and a name, and nothing else from their profile', () => {
    const shown = toParticipant({
      id: 'u1',
      email: 'hr@acme.example',
      role: 'EMPLOYER',
      employerProfile: { companyName: 'Acme Ltd' },
      jobSeekerProfile: { firstName: 'Hidden', lastName: 'Person' },
    });

    expect(shown).toEqual({ id: 'u1', email: 'hr@acme.example', role: 'EMPLOYER', name: 'Acme Ltd' });
  });

  it('asks the database only for fields it shows: never a password or token', () => {
    const text = JSON.stringify(participantSelect);

    expect(text).not.toMatch(/password|token|phone/i);
  });
});
