import { Hono } from 'hono';
import { FileController, type DriveEnv } from '../controllers/FileController';
import { Controller } from '../utils/controller';
import { resolveDrive } from '../middleware/resolveDrive';
import { DriveController } from '../controllers/DriveController';

const route = new Hono<DriveEnv>();

route.get('drives', Controller(DriveController, 'list'));
route.get('drives/:id', Controller(DriveController, 'getById'));
route.post('drives/', Controller(DriveController, 'create'));
route.put('drives/:id', Controller(DriveController, 'update'));
route.delete('drives/:id', Controller(DriveController, 'remove'));

route.use('files/:driveId/*', resolveDrive);
route.use('files/:driveId', resolveDrive);

route.get('files/:driveId/list', Controller(FileController, 'list'));
route.post('files/:driveId/upload', Controller(FileController, 'upload'));
route.post('files/:driveId/upload-chunk', Controller(FileController, 'uploadChunk'));
route.post('files/:driveId/upload-complete', Controller(FileController, 'uploadComplete'));
route.get('files/:driveId/download', Controller(FileController, 'download'));
route.get('files/:driveId/preview', Controller(FileController, 'preview'));
route.get('files/:driveId/download-folder', Controller(FileController, 'downloadFolder'));
route.delete('files/:driveId', Controller(FileController, 'remove'));
route.post('files/:driveId/folder', Controller(FileController, 'createFolder'));
route.patch('files/:driveId/rename', Controller(FileController, 'rename'));
route.get('files/:driveId/search', Controller(FileController, 'search'));

export default route;
