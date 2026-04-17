export interface Persona {
  name: string;
  values: Record<string, string>;
}

export const anonymous: Persona = {
  name: 'anonymous',
  values: {
    'email': 'alex.taylor@example.test',
    'firstName': 'Alex',
    'lastName': 'Taylor',
    'fullName': 'Alex Taylor',
    'phone': '+15555550100',
    'query': 'sample search',
  },
};

export const newCustomer: Persona = {
  name: 'new-customer',
  values: {
    'email': 'morgan.quinn@example.test',
    'password': 'Correct-Horse-Battery-Staple-1',
    'firstName': 'Morgan',
    'lastName': 'Quinn',
    'fullName': 'Morgan Quinn',
    'phone': '+15555550110',
    'shipping.address': '123 Market Street',
    'shipping.city': 'San Francisco',
    'shipping.state': 'CA',
    'shipping.zip': '94103',
    'shipping.country': 'US',
    'card.number': '4242 4242 4242 4242',
    'card.exp': '12/34',
    'card.cvv': '123',
    'card.nameOnCard': 'Morgan Quinn',
  },
};

export const returningUser: Persona = {
  name: 'returning-user',
  values: {
    'email': 'sam.rivera@example.test',
    'password': 'Correct-Horse-Battery-Staple-2',
    'firstName': 'Sam',
    'lastName': 'Rivera',
    'fullName': 'Sam Rivera',
    'phone': '+15555550120',
  },
};

export const PERSONAS: Record<string, Persona> = {
  anonymous,
  'new-customer': newCustomer,
  'returning-user': returningUser,
};

export function resolvePersonaValue(personaName: string, key: string): string | undefined {
  return PERSONAS[personaName]?.values[key];
}
