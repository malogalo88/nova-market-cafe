import { ReactNode } from 'react';

export const BuilderLayout = ({
  leftPanel,
  centerPanel,
  rightPanel,
  bottomPanel,
}: {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  bottomPanel: ReactNode;
}) => {
  return (
    <div>
      <div>
        <div>{leftPanel}</div>
        <div>{centerPanel}</div>
        <div>{rightPanel}</div>
      </div>
      <div>{bottomPanel}</div>
    </div>
  );
};