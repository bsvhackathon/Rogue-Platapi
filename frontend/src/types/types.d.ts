declare module "react-toastify";

export interface Token {
  atomicBeefTX: HexString;
  txid: TXIDHexString;
  outputIndex: PositiveIntegerOrZero;
  lockingScript: HexString;
  satoshis: SatoshiValue;
}

export interface Advertisement {
  id: string;
  title: string;
  description: string;
  fileHash: string;
  endDate: Date;
  sponsor: string;
  rewardPerAnswer: number;
  serviceUrl: string;
}

export interface AdvertisementRecord {
  // On-chain data
  txid: string;
  outputIndex: number;
  title: string;
  description: string;
  fileHash: string;
  endDate: Date;
  sponsor: string;
  rewardPerAnswer: number;
  serviceUrl: string;

  // System fields
  createdAt: Date;
}
