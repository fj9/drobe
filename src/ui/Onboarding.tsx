import { useState } from 'preact/hooks';
import { actions, activePlan, useStore } from '../store/store';
import { NumberInput, go } from './common';

export function Onboarding() {
  const { data } = useStore();
  const plan = activePlan(data);
  const [step, setStep] = useState(0);
  const zones = [...data.zones].sort((a, b) => a.order - b.order);

  const finish = async () => { await actions.finishOnboarding(); go('/add'); };

  return (
    <section class="onboarding">
      {step === 0 && (
        <>
          <h1>Wardrobe Manager</h1>
          <p>Decide what earns a place on the rail, and stop the rail getting overfilled.</p>
          <p class="banner">Your data stays on this device. Nothing is sent anywhere. Export a backup from Settings now and then.</p>
          <button class="primary" onClick={() => setStep(1)}>Next</button>
        </>
      )}
      {step === 1 && (
        <>
          <h1>Your rails</h1>
          <p class="muted">One item takes one inch by default. Change these to match your wardrobe.</p>
          <div class="card">
            {zones.map((z) => (
              <div class="setting-row" key={z.id}>
                <span>{z.name} (inches)</span>
                <NumberInput label={`${z.name} capacity`} value={z.capacity} onChange={(n) => n !== undefined && actions.setCapacity(z.id, n)} />
              </div>
            ))}
          </div>
          <div class="actions"><button class="primary" onClick={() => setStep(2)}>Next</button><button class="ghost" onClick={() => setStep(0)}>Back</button></div>
        </>
      )}
      {step === 2 && (
        <>
          <h1>How many of each?</h1>
          <p class="muted">A target per category. It's a guide; you can change it any time.</p>
          <div class="card">
            {data.categories.map((c) => (
              <div class="setting-row" key={c.id}>
                <span>{c.name}</span>
                <NumberInput label={`${c.name} target`} value={plan.allocations[c.id]} onChange={(n) => actions.setTarget(c.id, n)} />
              </div>
            ))}
          </div>
          <div class="actions"><button class="primary" onClick={finish}>Start adding items</button><button class="ghost" onClick={() => setStep(1)}>Back</button></div>
          <p class="muted small">Prefer to import a setup from a CSV? <a href="#/settings" onClick={() => actions.finishOnboarding()}>Go to Settings</a>.</p>
        </>
      )}
    </section>
  );
}
