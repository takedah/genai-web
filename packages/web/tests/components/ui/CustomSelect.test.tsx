import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomSelect } from '@/components/ui/CustomSelect';

const options = [
  { value: 'a', label: 'モデルA', description: 'モデルAの説明' },
  { value: 'b', label: 'モデルB' },
];

const renderCustomSelect = (value = 'a') =>
  render(<CustomSelect value={value} options={options} onChange={vi.fn()} />);

describe('CustomSelect', () => {
  it('description のある option を開くと説明文が表示される', async () => {
    const user = userEvent.setup();
    renderCustomSelect();

    await user.click(screen.getByRole('button'));

    expect(screen.queryByText('モデルAの説明')).not.toBeNull();
  });

  it('description のない option では説明文の要素が描画されない', async () => {
    const user = userEvent.setup();
    renderCustomSelect();

    await user.click(screen.getByRole('button'));

    const optionB = screen.getByRole('option', { name: 'モデルB' });
    expect(optionB.textContent?.trim()).toBe('モデルB');
  });

  it('選択中ラベル（ボタン）には説明文が含まれない', () => {
    renderCustomSelect();

    const button = screen.getByRole('button');
    expect(button.textContent).toContain('モデルA');
    expect(button.textContent).not.toContain('モデルAの説明');
  });

  it('各選択肢は role="option" を持つ', async () => {
    const user = userEvent.setup();
    renderCustomSelect();

    await user.click(screen.getByRole('button'));

    expect(screen.getAllByRole('option')).toHaveLength(options.length);
  });
});
