import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { SERVICES } from '../../common/constants';
import { AppError } from '../../common/appError';
import { IConfig, UpdatePayload } from '../../common/interfaces';
import { CatalogConfig } from './interfaces';

@injectable()
export class CatalogCall {
  private readonly catalog: CatalogConfig;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.catalog = this.config.get<CatalogConfig>('catalog');
  }

  public async isRecordExist(identifier: string): Promise<boolean> {
    this.logger.debug({
      msg: 'Get Record from catalog service (CRUD)',
    });
    try {
      const response = await axios.get(`${this.catalog.url}/${this.catalog.subUrl}/${identifier}`);
      if (response.status === StatusCodes.OK.valueOf()) {
        return true;
      }
      if (response.status === StatusCodes.NOT_FOUND.valueOf()) {
        return false;
      }
      this.logger.error({ msg: 'Got unexpected status-code form catalog', response });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'Problem with the catalog during validation of record existence', true);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'Something went wrong in catalog', error });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'there is a problem with catalog', true);
    }
  }

  public async isProductIdExist(productId: string): Promise<boolean> {
    this.logger.debug({
      msg: 'Find last version of product from catalog service (CRUD)',
    });
    try {
      const response = await axios.get(`${this.catalog.url}/${this.catalog.subUrl}/lastVersion/${productId}`);
      if (response.status === StatusCodes.OK.valueOf()) {
        return true;
      }
      if (response.status === StatusCodes.NOT_FOUND.valueOf()) {
        return false;
      }
      this.logger.error({ msg: 'Got unexpected status-code form catalog', response });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'Problem with the catalog during validation of productId existence', true);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'Something went wrong in catalog', error });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'there is a problem with catalog', true);
    }
  }

  public async patchMetadata(identifier: string, payload: UpdatePayload): Promise<unknown> {
    this.logger.debug({
      msg: 'Send post request to catalog service (CRUD) in order to update metadata',
    });
    const response = await axios.patch(`${this.catalog.url}/${this.catalog.subUrl}/${identifier}`, payload);
    if (response.status === StatusCodes.OK.valueOf()) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return response.data;
    }
    this.logger.error({ msg: 'Got unexpected status-code form catalog', response });
    throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'Problem with the catalog during send updatedMetadata', true);
  }
}
