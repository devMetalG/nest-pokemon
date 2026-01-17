import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';
import { isValidObjectId, Model } from 'mongoose';
import { Pokemon } from './entities/pokemon.entity';
import { InjectModel } from '@nestjs/mongoose';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';

interface MongoError {
  code: number;
  keyValue: Record<string, any>;
}

@Injectable()
export class PokemonService {
  private defaultLimit: number | undefined;
  constructor(
    @InjectModel(Pokemon.name)
    private readonly pokemonModel: Model<Pokemon>,
    private readonly configService: ConfigService,
  ) {
    this.defaultLimit = this.configService.get<number>('defaultLimit');
  }
  async create(createPokemonDto: CreatePokemonDto) {
    createPokemonDto.name = createPokemonDto.name.toLowerCase();
    try {
      const pokemon = await this.pokemonModel.create(createPokemonDto);
      return pokemon;
    } catch (error) {
      this.handleException(error, 'create');
    }
  }

  findAll(queryParams: PaginationDto) {
    const { limit = this.defaultLimit!, offset = 0 } = queryParams;
    return this.pokemonModel
      .find()
      .skip(offset)
      .limit(limit)
      .sort({ no: 1 })
      .select('-__v');
  }

  async findOne(term: string) {
    let pokemon: Pokemon | null = null;
    if (!isNaN(+term)) {
      pokemon = await this.pokemonModel.findOne({ no: +term });
    }

    // MongoID
    if (!pokemon && isValidObjectId(term)) {
      pokemon = await this.pokemonModel.findById(term);
    }

    // Name
    if (!pokemon) {
      pokemon = await this.pokemonModel.findOne({
        name: term.toLowerCase().trim(),
      });
    }

    if (!pokemon)
      throw new NotFoundException(
        `Pokemon with id, name or no "${term}" not found`,
      );

    return pokemon;
  }

  async update(term: string, updatePokemonDto: UpdatePokemonDto) {
    const pokemon = await this.findOne(term);
    if (updatePokemonDto.name)
      updatePokemonDto.name = updatePokemonDto.name.toLowerCase();
    try {
      const updatedPokemon = await this.pokemonModel.findByIdAndUpdate(
        pokemon.get('_id'),
        updatePokemonDto,
        {
          new: true,
        },
      );
      return updatedPokemon;
    } catch (error) {
      this.handleException(error, 'update');
    }
  }

  async remove(id: string) {
    const { deletedCount } = await this.pokemonModel.deleteOne({ _id: id });
    if (deletedCount === 0)
      throw new BadRequestException(`Pokemon with id "${id}" not found`);
    return deletedCount;
  }

  private handleException(error: any, type: string) {
    const mongoError = error as MongoError;
    if (mongoError.code === 11000) {
      throw new BadRequestException(
        `Pokemon already exists in DB ${JSON.stringify(mongoError.keyValue)}`,
      );
    }
    console.log(mongoError);
    throw new InternalServerErrorException(
      `Can not ${type} Pokemon - Check server logs`,
    );
  }
}
