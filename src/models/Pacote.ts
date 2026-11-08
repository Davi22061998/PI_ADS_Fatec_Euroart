import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import type Embalagem from './Embalagem';
import type ItemPacote from './ItemPacote';

export type StatusPacote = 'pendente' | 'ok' | 'divergente_peso' | 'bloqueado' | 'liberado_divergente';

export interface PacoteAttributes {
  id: number;
  chave_acesso: string;
  remessa_id: number;
  numero_nf?: string | null;
  razao_social?: string | null;
  descricao_produto?: string | null;
  uf?: string | null;
  status: StatusPacote;
  possui_guia_icms: boolean;
  peso_esperado_g?: number | null;
  peso_lido_g?: number | null;
  tentativas_peso: number;
  justificativa_liberacao?: string | null;
  usuario_liberacao_id?: number | null;
  caixa_id?: number | null;
  data_conferido?: Date | null;
}

export interface PacoteCreationAttributes extends Optional<
  PacoteAttributes,
  | 'id'
  | 'numero_nf'
  | 'razao_social'
  | 'descricao_produto'
  | 'uf'
  | 'status'
  | 'possui_guia_icms'
  | 'peso_esperado_g'
  | 'peso_lido_g'
  | 'tentativas_peso'
  | 'justificativa_liberacao'
  | 'usuario_liberacao_id'
  | 'caixa_id'
  | 'data_conferido'
> {}

export class Pacote extends Model<PacoteAttributes, PacoteCreationAttributes> implements PacoteAttributes {
  public declare id: number;
  public declare chave_acesso: string;
  public declare remessa_id: number;
  public declare numero_nf: string | null;
  public declare razao_social: string | null;
  public declare descricao_produto: string | null;
  public declare uf: string | null;
  public declare status: StatusPacote;
  public declare possui_guia_icms: boolean;
  public declare peso_esperado_g: number | null;
  public declare peso_lido_g: number | null;
  public declare tentativas_peso: number;
  public declare justificativa_liberacao: string | null;
  public declare usuario_liberacao_id: number | null;
  public declare caixa_id: number | null;
  public declare data_conferido: Date | null;

  public declare embalagem?: Embalagem | null;
  public declare itens?: ItemPacote[];
}

Pacote.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chave_acesso: {
      type: DataTypes.STRING(44),
      allowNull: false,
    },
    remessa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    numero_nf: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    razao_social: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    descricao_produto: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    uf: {
      type: DataTypes.CHAR(2),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pendente',
    },
    possui_guia_icms: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    peso_esperado_g: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    peso_lido_g: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    tentativas_peso: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    justificativa_liberacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    usuario_liberacao_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    caixa_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    data_conferido: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'pacotes',
    timestamps: false,
  }
);

export default Pacote;
