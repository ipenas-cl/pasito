import { describe, expect, it } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { SpeakModule } from './modules/SpeakModule';
import { NumbersModule } from './modules/NumbersModule';
import { ReadModule } from './modules/ReadModule';
import { ParentGate } from './components/common';
import { FakeListener, FakeSpeaker, setup } from '../test/helpers';
import { MemoryRepository } from '../infra/memoryRepository';
import { createRng, generateTask, taskAnswer, SPEAK_ITEMS, BUILD_WORDS } from '../domain';

const child = { id: 'c1', name: 'Sofi', avatar: '🦊', createdAt: 0 };

function passGate() {
  const q = screen.getByTestId('gate-question');
  fireEvent.click(screen.getByRole('button', { name: q.dataset.answer }));
}

describe('App', () => {
  it('first run: parent gate, create profile, child sees the modules', async () => {
    const user = userEvent.setup();
    setup(<App seed={1} />);
    await user.click(await screen.findByTestId('start'));
    passGate();
    await user.type(await screen.findByTestId('child-name'), 'Sofi');
    await user.click(screen.getByTestId('save-child'));
    expect(await screen.findByTestId('child-card-Sofi')).toBeInTheDocument();
    await user.click(screen.getByTestId('exit-parent'));
    await user.click(await screen.findByTestId('profile-Sofi'));
    expect(screen.getByTestId('mod-speak')).toHaveAccessibleName('Hablar');
    expect(screen.getByTestId('mod-numbers')).toBeInTheDocument();
    expect(screen.getByTestId('mod-read')).toBeInTheDocument();
  });

  it('kid view contains no external links', async () => {
    const repo = new MemoryRepository();
    await repo.saveChild(child);
    const { container } = setup(<App seed={1} />, { repo });
    fireEvent.click(await screen.findByTestId('profile-Sofi'));
    expect(container.querySelectorAll('a[href]')).toHaveLength(0);
  });

  it('a wrong gate answer keeps the parent area closed', async () => {
    let passed = false;
    let cancelled = false;
    setup(<ParentGate seed={5} onPass={() => (passed = true)} onCancel={() => (cancelled = true)} />);
    const answer = Number(screen.getByTestId('gate-question').dataset.answer);
    const wrong = within(screen.getByRole('dialog')).getAllByRole('button').find((b) => /^\d+$/.test(b.textContent ?? '') && Number(b.textContent) !== answer)!;
    fireEvent.click(wrong);
    expect(passed).toBe(false);
    expect(cancelled).toBe(true);
  });
});

describe('SpeakModule', () => {
  it('speaks the word and gives positive feedback on a good attempt', async () => {
    const speaker = new FakeSpeaker();
    const first = SPEAK_ITEMS[0];
    const listener = new FakeListener(true, [first.es]);
    const repo = new MemoryRepository();
    setup(<SpeakModule child={child} onHome={() => {}} />, { speaker, listener, repo });
    fireEvent.click(await screen.findByTestId('stage-sounds'));
    const word = await screen.findByTestId('speak-word');
    expect(speaker.spoken).toContain(word.textContent);
    listener.heard = [word.textContent!];
    fireEvent.click(screen.getByTestId('mic'));
    await waitFor(() => expect(screen.getByTestId('feedback')).toHaveTextContent('¡Muy bien!'));
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0].correct).toBe(true);
  });

  it('locks later stages until earlier ones are mastered', async () => {
    setup(<SpeakModule child={child} onHome={() => {}} />);
    expect(await screen.findByTestId('stage-words')).toBeDisabled();
  });

  it('offers a self-check when speech recognition is unavailable', async () => {
    setup(<SpeakModule child={child} onHome={() => {}} />, { listener: new FakeListener(false) });
    fireEvent.click(await screen.findByTestId('stage-sounds'));
    fireEvent.click(await screen.findByTestId('self-check'));
    expect(await screen.findByTestId('next')).toBeInTheDocument();
  });
});

describe('NumbersModule', () => {
  it('accepts the right answer and persists difficulty', async () => {
    const repo = new MemoryRepository();
    setup(<NumbersModule child={child} onHome={() => {}} seed={11} />, { repo });
    const expected = generateTask(createRng(11), 1);
    const ans = taskAnswer(expected);
    fireEvent.click(await screen.findByTestId(`choice-${ans}`));
    await waitFor(() => expect(screen.getByTestId('dropzone')).toHaveTextContent(String(ans)));
    expect(screen.getByTestId('feedback')).toHaveTextContent('¡Muy bien!');
    await waitFor(() => expect(repo.diff.get('c1:numbers')?.recent).toEqual([true]));
  });

  it('levels up after five correct answers', async () => {
    const repo = new MemoryRepository();
    const user = userEvent.setup();
    setup(<NumbersModule child={child} onHome={() => {}} seed={3} />, { repo });
    for (let i = 0; i < 5; i++) {
      await screen.findByTestId('dropzone');
      const options = screen.getAllByTestId(/^choice-/);
      const objects = screen.queryByTestId('objects');
      const n = objects ? objects.querySelectorAll('span').length : NaN;
      const btn = options.find((o) => o.textContent === String(n))!;
      await user.click(btn);
      await user.click(await screen.findByTestId('next'));
    }
    expect(screen.getByTestId('level')).toHaveAccessibleName('Nivel 2');
  });
});

describe('ReadModule', () => {
  it('builds a word from syllables in order', async () => {
    const user = userEvent.setup();
    const speaker = new FakeSpeaker();
    const repo = new MemoryRepository();
    setup(<ReadModule child={child} onHome={() => {}} seed={2} />, { speaker, repo });
    await user.click(screen.getByTestId('tab-build'));
    const target = BUILD_WORDS.find((w) => speaker.spoken.includes(w.word))!;
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(target.syllables.length + 2);
    const wrong = screen.getAllByTestId(/^tile-/).find((b) => b.textContent !== target.syllables[0])!;
    await user.click(wrong);
    expect(screen.getByTestId('slots')).toHaveAccessibleName('');
    for (const s of target.syllables) await user.click(screen.getByTestId(`tile-${s}`));
    expect(screen.getByTestId('slots')).toHaveAccessibleName(target.syllables.join(''));
    expect(await screen.findByTestId('next')).toBeInTheDocument();
    await waitFor(() => expect(repo.events.at(-1)).toMatchObject({ module: 'read', itemId: `build:${target.word}`, correct: false }));
  });

  it('highlights words while reading a story aloud', async () => {
    const user = userEvent.setup();
    setup(<ReadModule child={child} onHome={() => {}} />);
    await user.click(screen.getByTestId('tab-stories'));
    await user.click(screen.getByTestId('story-mi-mama'));
    await user.click(screen.getByTestId('play'));
    await waitFor(() => expect(screen.getByTestId('story-text').querySelector('[data-current="true"]')).not.toBeNull());
  });
});
